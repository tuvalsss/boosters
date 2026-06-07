import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma, type BuybackQuote, type PrismaClient, type User } from '@boosters/db';
import type { Env } from '@boosters/config';
import { ENV } from '../config/config.module.js';
import { PRISMA } from '../prisma/prisma.module.js';
import { AuditService } from '../audit/audit.service.js';
import { LedgerService } from '../ledger/ledger.service.js';
import { SETTING_BUYBACK_PAUSED, SettingsService } from '../settings/settings.service.js';

const QUOTE_TTL_MS = 10 * 60 * 1000; // 10 minutes

@Injectable()
export class BuybackService {
  private readonly logger = new Logger(BuybackService.name);

  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    @Inject(ENV) private readonly env: Env,
    private readonly ledger: LedgerService,
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
  ) {}

  private get floor(): Prisma.Decimal {
    return new Prisma.Decimal(this.env.BUYBACK_FLOAT_FLOOR_USDC);
  }

  /** The custodial treasury account that bought-back tokens return to. */
  private async treasuryUser(): Promise<User> {
    return this.prisma.user.upsert({
      where: { email: 'treasury@boosters.local' },
      update: {},
      create: { email: 'treasury@boosters.local', role: 'ADMIN', hold: 'NONE' },
    });
  }

  // ---- Quote ----------------------------------------------------------------

  async quote(user: User, vaultItemId: string): Promise<BuybackQuote> {
    if (await this.settings.getBool(SETTING_BUYBACK_PAUSED)) {
      throw new BadRequestException('Buyback is currently paused');
    }
    const item = await this.prisma.vaultItem.findUnique({
      where: { id: vaultItemId },
      include: { token: true },
    });
    if (!item) throw new NotFoundException('Vault item not found');
    if (item.ownerId !== user.id) throw new ForbiddenException('You do not own this item');
    if (item.state !== 'VAULTED' || !item.token || item.token.status !== 'ACTIVE') {
      throw new BadRequestException('Item is not a vaulted, active token');
    }

    const fmv = await this.prisma.fmvSnapshot.findFirst({
      where: { OR: [{ vaultItemId }, { physicalCardId: item.physicalCardId }] },
      orderBy: { capturedAt: 'desc' },
    });
    if (!fmv) throw new BadRequestException('No FMV is available for this item yet');

    const percentBps = this.env.BUYBACK_DEFAULT_PERCENT_BPS;
    const quoteUsdc = fmv.valueUsdc
      .mul(percentBps)
      .div(10000)
      .toDecimalPlaces(6, Prisma.Decimal.ROUND_DOWN);

    const quote = await this.prisma.buybackQuote.create({
      data: {
        vaultItemId,
        userId: user.id,
        fmvSnapshotId: fmv.id,
        percentBps,
        quoteUsdc,
        status: 'QUOTED',
        expiresAt: new Date(Date.now() + QUOTE_TTL_MS),
      },
    });
    await this.audit.log({
      actorId: user.id,
      entityType: 'BuybackQuote',
      entityId: quote.id,
      action: 'BUYBACK_QUOTED',
      metadata: { vaultItemId, quoteUsdc: quoteUsdc.toString() },
    });
    return quote;
  }

  // ---- Accept (the payout money path) ---------------------------------------

  async accept(user: User, quoteId: string): Promise<BuybackQuote> {
    const quote = await this.prisma.buybackQuote.findUnique({
      where: { id: quoteId },
      include: { vaultItem: { include: { token: true } } },
    });
    if (!quote) throw new NotFoundException('Quote not found');
    if (quote.userId !== user.id) throw new ForbiddenException('Not your quote');
    if (quote.status !== 'QUOTED') throw new BadRequestException(`Quote is ${quote.status}`);
    if (quote.expiresAt.getTime() < Date.now()) {
      await this.prisma.buybackQuote.update({
        where: { id: quoteId },
        data: { status: 'EXPIRED' },
      });
      throw new BadRequestException('Quote has expired');
    }
    if (await this.settings.getBool(SETTING_BUYBACK_PAUSED)) {
      throw new BadRequestException('Buyback is currently paused');
    }

    const item = quote.vaultItem;
    if (
      item.ownerId !== user.id ||
      item.state !== 'VAULTED' ||
      !item.token ||
      item.token.status !== 'ACTIVE'
    ) {
      throw new BadRequestException('Item is no longer eligible');
    }

    // HARD GUARD (spec §9): treasury can never be drained below the float floor.
    const treasuryBalance = await this.ledger.treasuryBalance();
    if (treasuryBalance.sub(quote.quoteUsdc).lt(this.floor)) {
      throw new BadRequestException(
        `Buyback would breach the treasury float floor (${this.floor.toString()} USDC). Try again later.`,
      );
    }

    const treasury = await this.treasuryUser();
    const tokenId = item.token.id;

    const settled = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          type: 'BUYBACK_PAYOUT',
          status: 'COMPLETED',
          buyerId: treasury.id,
          sellerId: user.id,
          amountUsdc: quote.quoteUsdc,
          idempotencyKey: `buyback_${quote.id}`,
        },
      });
      await this.ledger.post(tx, order.id, [
        {
          accountType: 'TREASURY',
          direction: 'DEBIT',
          amountUsdc: quote.quoteUsdc,
          memo: 'Buyback payout',
        },
        {
          accountType: 'USER_WALLET',
          userId: user.id,
          direction: 'CREDIT',
          amountUsdc: quote.quoteUsdc,
          memo: 'Buyback proceeds',
        },
      ]);
      // Token returns to the treasury (re-listable as first-party inventory).
      await tx.token.update({ where: { id: tokenId }, data: { ownerId: treasury.id } });
      await tx.vaultItem.update({ where: { id: item.id }, data: { ownerId: treasury.id } });
      return tx.buybackQuote.update({
        where: { id: quoteId },
        data: { status: 'PAID', orderId: order.id },
      });
    });

    await this.audit.log({
      actorId: user.id,
      entityType: 'BuybackQuote',
      entityId: quoteId,
      action: 'BUYBACK_ACCEPTED',
      metadata: { quoteUsdc: quote.quoteUsdc.toString(), vaultItemId: item.id },
    });
    return settled;
  }

  // ---- Admin ----------------------------------------------------------------

  async setPaused(actor: User, paused: boolean) {
    await this.settings.setBool(SETTING_BUYBACK_PAUSED, paused);
    await this.audit.log({
      actorId: actor.id,
      entityType: 'Setting',
      entityId: SETTING_BUYBACK_PAUSED,
      action: 'BUYBACK_PAUSE',
      toState: String(paused),
    });
    return { paused };
  }

  async setFmv(actor: User, vaultItemId: string, valueUsdc: string) {
    const item = await this.prisma.vaultItem.findUnique({ where: { id: vaultItemId } });
    if (!item) throw new NotFoundException('Vault item not found');
    const snap = await this.prisma.fmvSnapshot.create({
      data: {
        vaultItemId,
        physicalCardId: item.physicalCardId,
        source: 'MANUAL',
        valueUsdc: new Prisma.Decimal(valueUsdc),
      },
    });
    await this.audit.log({
      actorId: actor.id,
      entityType: 'VaultItem',
      entityId: vaultItemId,
      action: 'FMV_SET',
      metadata: { valueUsdc },
    });
    return snap;
  }

  /** Devnet: fund the treasury float so buyback can pay out. */
  async creditTreasury(actor: User, amountUsdc: string) {
    const amount = new Prisma.Decimal(amountUsdc);
    if (amount.lte(0)) throw new BadRequestException('Amount must be greater than zero');
    await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          type: 'DEPOSIT',
          status: 'COMPLETED',
          amountUsdc: amount,
          idempotencyKey: `treasury_${randomUUID()}`,
        },
      });
      await this.ledger.post(tx, order.id, [
        {
          accountType: 'EXTERNAL',
          direction: 'DEBIT',
          amountUsdc: amount,
          memo: 'Treasury funding',
        },
        {
          accountType: 'TREASURY',
          direction: 'CREDIT',
          amountUsdc: amount,
          memo: 'Treasury funding',
        },
      ]);
    });
    await this.audit.log({
      actorId: actor.id,
      entityType: 'Treasury',
      entityId: 'treasury',
      action: 'TREASURY_CREDITED',
      metadata: { amountUsdc },
    });
    return this.treasuryStatus();
  }

  async treasuryStatus() {
    const balance = await this.ledger.treasuryBalance();
    const paused = await this.settings.getBool(SETTING_BUYBACK_PAUSED);
    const available = balance.sub(this.floor);
    return {
      balanceUsdc: balance.toString(),
      floorUsdc: this.floor.toString(),
      availableForBuybackUsdc: (available.gt(0) ? available : new Prisma.Decimal(0)).toString(),
      paused,
    };
  }
}
