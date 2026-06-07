import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes, randomUUID } from 'node:crypto';
import { Prisma, type PrismaClient, type Raffle, type User } from '@boosters/db';
import type { Env } from '@boosters/config';
import { ENV } from '../config/config.module.js';
import { PRISMA } from '../prisma/prisma.module.js';
import { AuditService } from '../audit/audit.service.js';
import { LedgerService } from '../ledger/ledger.service.js';
import { CNFT_TRANSFERRER, type CnftTransferrer } from '../marketplace/cnft-transferrer.js';
import {
  commitmentHash,
  draw,
  DRAW_ALGORITHM,
  type PoolCandidate,
} from '../packs/pack-fairness.js';

@Injectable()
export class RafflesService {
  private readonly logger = new Logger(RafflesService.name);

  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    @Inject(ENV) private readonly env: Env,
    @Inject(CNFT_TRANSFERRER) private readonly transferrer: CnftTransferrer,
    private readonly ledger: LedgerService,
    private readonly audit: AuditService,
  ) {}

  // ---- Create / list --------------------------------------------------------

  /** List a vaulted item as a raffle. The item is RESERVED while the raffle runs. */
  async create(
    owner: User,
    vaultItemId: string,
    ticketSupply: number,
    ticketPriceUsdc: string,
  ): Promise<Raffle> {
    if (ticketSupply < 2) throw new BadRequestException('Ticket supply must be at least 2');
    const price = new Prisma.Decimal(ticketPriceUsdc);
    if (price.lte(0)) throw new BadRequestException('Ticket price must be greater than zero');

    const item = await this.prisma.vaultItem.findUnique({
      where: { id: vaultItemId },
      include: { token: true },
    });
    if (!item) throw new NotFoundException('Vault item not found');
    if (item.ownerId !== owner.id) throw new ForbiddenException('You do not own this item');
    if (item.state !== 'VAULTED' || !item.token || item.token.status !== 'ACTIVE') {
      throw new BadRequestException('Item is not a vaulted, active token');
    }

    const raffle = await this.prisma.$transaction(async (tx) => {
      await tx.vaultItem.update({ where: { id: vaultItemId }, data: { state: 'RESERVED' } });
      return tx.raffle.create({
        data: { vaultItemId, ticketSupply, ticketPriceUsdc: price, status: 'ACTIVE' },
      });
    });
    await this.audit.log({
      actorId: owner.id,
      entityType: 'Raffle',
      entityId: raffle.id,
      action: 'RAFFLE_CREATED',
      metadata: { vaultItemId, ticketSupply },
    });
    return raffle;
  }

  async listActive() {
    return this.prisma.raffle.findMany({
      where: { status: { in: ['ACTIVE', 'SOLD_OUT'] } },
      include: { vaultItem: { include: { physicalCard: { include: { photos: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(id: string) {
    const raffle = await this.prisma.raffle.findUnique({
      where: { id },
      include: { vaultItem: { include: { physicalCard: { include: { photos: true } } } } },
    });
    if (!raffle) throw new NotFoundException('Raffle not found');
    return raffle;
  }

  // ---- Buy tickets ----------------------------------------------------------

  async buyTickets(
    user: User,
    raffleId: string,
    qty: number,
  ): Promise<{ bought: number; ticketsSold: number }> {
    if (qty < 1) throw new BadRequestException('Quantity must be at least 1');
    if (user.hold === 'SUSPENDED') throw new ForbiddenException('Account suspended');

    const raffle = await this.prisma.raffle.findUnique({ where: { id: raffleId } });
    if (!raffle || raffle.status !== 'ACTIVE')
      throw new BadRequestException('Raffle is not active');
    const remaining = raffle.ticketSupply - raffle.ticketsSold;
    if (qty > remaining) throw new BadRequestException(`Only ${remaining} tickets remain`);

    const cost = raffle.ticketPriceUsdc.mul(qty);
    const balance = await this.ledger.balanceOf(user.id);
    if (balance.lt(cost)) throw new BadRequestException('Insufficient USDC balance');

    const result = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          type: 'RAFFLE_TICKET',
          status: 'COMPLETED',
          buyerId: user.id,
          amountUsdc: cost,
          idempotencyKey: `raffle_${randomUUID()}`,
        },
      });
      await this.ledger.post(tx, order.id, [
        {
          accountType: 'USER_WALLET',
          userId: user.id,
          direction: 'DEBIT',
          amountUsdc: cost,
          memo: 'Raffle tickets',
        },
        { accountType: 'ESCROW', direction: 'CREDIT', amountUsdc: cost, memo: 'Raffle escrow' },
      ]);
      // Re-read under the row lock to avoid oversell on concurrency.
      const fresh = await tx.raffle.findUniqueOrThrow({ where: { id: raffleId } });
      if (fresh.ticketsSold + qty > fresh.ticketSupply) throw new BadRequestException('Sold out');
      const start = fresh.ticketsSold;
      await tx.raffleTicket.createMany({
        data: Array.from({ length: qty }, (_, i) => ({
          raffleId,
          userId: user.id,
          ticketNumber: start + i,
          orderId: i === 0 ? order.id : null,
        })),
      });
      const ticketsSold = start + qty;
      await tx.raffle.update({
        where: { id: raffleId },
        data: { ticketsSold, status: ticketsSold >= fresh.ticketSupply ? 'SOLD_OUT' : 'ACTIVE' },
      });
      return { bought: qty, ticketsSold };
    });
    return result;
  }

  // ---- Draw (provably fair) -------------------------------------------------

  async draw(actor: User, raffleId: string): Promise<Raffle> {
    const raffle = await this.prisma.raffle.findUnique({
      where: { id: raffleId },
      include: { vaultItem: { include: { token: true, owner: true } } },
    });
    if (!raffle) throw new NotFoundException('Raffle not found');
    if (raffle.status !== 'SOLD_OUT')
      throw new BadRequestException('Raffle must be sold out to draw');

    const tickets = await this.prisma.raffleTicket.findMany({
      where: { raffleId },
      orderBy: { ticketNumber: 'asc' },
    });
    const candidates: PoolCandidate[] = tickets.map((t) => ({
      poolItemId: t.id,
      vaultItemId: t.userId,
      weight: 1,
    }));

    const serverSeed = randomBytes(32).toString('hex');
    const serverSeedHash = commitmentHash(serverSeed);
    const result = draw(serverSeed, raffleId, 0, candidates);
    const winningTicket = tickets[result.index]!;
    const winnerId = winningTicket.userId;

    const total = raffle.ticketPriceUsdc.mul(raffle.ticketsSold);
    const fee = total
      .mul(this.env.MARKETPLACE_FEE_BPS)
      .div(10000)
      .toDecimalPlaces(6, Prisma.Decimal.ROUND_DOWN);
    const proceeds = total.sub(fee);
    const sellerId = raffle.vaultItem.ownerId;
    const tokenId = raffle.vaultItem.token!.id;
    const fromWallet = raffle.vaultItem.owner.walletAddress;

    const proof = {
      algorithm: DRAW_ALGORITHM,
      serverSeed,
      serverSeedHash,
      float: result.float,
      floatHex: result.floatHex,
      winningTicketNumber: winningTicket.ticketNumber,
    };

    const settled = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          type: 'RAFFLE_TICKET',
          status: 'COMPLETED',
          buyerId: winnerId,
          sellerId,
          amountUsdc: total,
          feeUsdc: fee,
          idempotencyKey: `raffle_draw_${raffleId}`,
        },
      });
      await this.ledger.post(tx, order.id, [
        { accountType: 'ESCROW', direction: 'DEBIT', amountUsdc: total, memo: 'Raffle settlement' },
        {
          accountType: 'USER_WALLET',
          userId: sellerId,
          direction: 'CREDIT',
          amountUsdc: proceeds,
          memo: 'Raffle proceeds',
        },
        { accountType: 'FEE_REVENUE', direction: 'CREDIT', amountUsdc: fee, memo: 'Raffle fee' },
      ]);
      await tx.raffleTicket.update({ where: { id: winningTicket.id }, data: { status: 'WON' } });
      await tx.token.update({ where: { id: tokenId }, data: { ownerId: winnerId } });
      await tx.vaultItem.update({
        where: { id: raffle.vaultItemId },
        data: { ownerId: winnerId, state: 'VAULTED' },
      });
      return tx.raffle.update({
        where: { id: raffleId },
        data: { status: 'SETTLED', winnerId, drawnAt: new Date(), vrfProof: JSON.stringify(proof) },
      });
    });

    try {
      const winner = await this.prisma.user.findUnique({ where: { id: winnerId } });
      if (this.transferrer.isConfigured && fromWallet && winner?.walletAddress) {
        await this.transferrer.transfer({
          assetId: raffle.vaultItem.token!.cnftAssetId,
          fromWallet,
          toWallet: winner.walletAddress,
        });
      }
    } catch (err) {
      this.logger.error(`Raffle on-chain transfer deferred: ${(err as Error).message}`);
    }

    await this.audit.log({
      actorId: actor.id,
      entityType: 'Raffle',
      entityId: raffleId,
      action: 'RAFFLE_DRAWN',
      metadata: { winnerId, winningTicketNumber: winningTicket.ticketNumber },
    });
    return settled;
  }

  // ---- Cancel (refund all tickets) ------------------------------------------

  async cancel(actor: User, raffleId: string): Promise<Raffle> {
    const raffle = await this.prisma.raffle.findUnique({ where: { id: raffleId } });
    if (!raffle) throw new NotFoundException('Raffle not found');
    if (!['ACTIVE', 'SOLD_OUT'].includes(raffle.status))
      throw new BadRequestException(`Raffle is ${raffle.status}`);

    const tickets = await this.prisma.raffleTicket.findMany({ where: { raffleId } });
    // Aggregate refunds per user.
    const perUser = new Map<string, number>();
    for (const t of tickets) perUser.set(t.userId, (perUser.get(t.userId) ?? 0) + 1);

    const cancelled = await this.prisma.$transaction(async (tx) => {
      if (tickets.length > 0) {
        const total = raffle.ticketPriceUsdc.mul(tickets.length);
        const order = await tx.order.create({
          data: {
            type: 'REFUND',
            status: 'COMPLETED',
            amountUsdc: total,
            idempotencyKey: `raffle_refund_${raffleId}`,
          },
        });
        const lines = [
          {
            accountType: 'ESCROW' as const,
            direction: 'DEBIT' as const,
            amountUsdc: total,
            memo: 'Raffle refund',
          },
          ...[...perUser.entries()].map(([userId, count]) => ({
            accountType: 'USER_WALLET' as const,
            userId,
            direction: 'CREDIT' as const,
            amountUsdc: raffle.ticketPriceUsdc.mul(count),
            memo: 'Raffle refund',
          })),
        ];
        await this.ledger.post(tx, order.id, lines);
        await tx.raffleTicket.updateMany({ where: { raffleId }, data: { status: 'REFUNDED' } });
      }
      await tx.vaultItem.update({ where: { id: raffle.vaultItemId }, data: { state: 'VAULTED' } });
      return tx.raffle.update({ where: { id: raffleId }, data: { status: 'CANCELLED' } });
    });

    await this.audit.log({
      actorId: actor.id,
      entityType: 'Raffle',
      entityId: raffleId,
      action: 'RAFFLE_CANCELLED',
      metadata: { refundedTickets: tickets.length },
    });
    return cancelled;
  }
}
