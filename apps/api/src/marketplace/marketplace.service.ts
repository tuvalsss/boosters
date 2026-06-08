import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma, type CardCategory, type Order, type PrismaClient, type User } from '@boosters/db';
import type { Env } from '@boosters/config';
import { ENV } from '../config/config.module.js';
import { PRISMA } from '../prisma/prisma.module.js';
import { AuditService } from '../audit/audit.service.js';
import { LedgerService } from '../ledger/ledger.service.js';
import { CNFT_TRANSFERRER, type CnftTransferrer } from './cnft-transferrer.js';

@Injectable()
export class MarketplaceService {
  private readonly logger = new Logger(MarketplaceService.name);

  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    @Inject(ENV) private readonly env: Env,
    @Inject(CNFT_TRANSFERRER) private readonly transferrer: CnftTransferrer,
    private readonly ledger: LedgerService,
    private readonly audit: AuditService,
  ) {}

  // ---- Listings -------------------------------------------------------------

  /** List a vaulted, tokenized item the seller owns. Gate: only VAULTED items. */
  async createListing(seller: User, vaultItemId: string, priceUsdc: string) {
    const price = new Prisma.Decimal(priceUsdc);
    if (price.lte(0)) throw new BadRequestException('Price must be greater than zero');
    // Anti-fraud (spec §7): account holds block selling until ops clear them.
    if (seller.hold !== 'NONE') {
      throw new ForbiddenException(`Account is on hold (${seller.hold}) and cannot list`);
    }

    const item = await this.prisma.vaultItem.findUnique({
      where: { id: vaultItemId },
      include: { token: true },
    });
    if (!item) throw new NotFoundException('Vault item not found');
    if (item.ownerId !== seller.id) throw new ForbiddenException('You do not own this item');
    // Custody gate: cannot list what is not vaulted + tokenized + active.
    if (item.state !== 'VAULTED' || !item.token || item.token.status !== 'ACTIVE') {
      throw new BadRequestException('Item is not a vaulted, active token');
    }

    const type = seller.role === 'ADMIN' || seller.role === 'OPS' ? 'FIRST_PARTY' : 'P2P';
    const fmv = await this.prisma.fmvSnapshot.findFirst({
      where: { OR: [{ vaultItemId }, { physicalCardId: item.physicalCardId }] },
      orderBy: { capturedAt: 'desc' },
    });

    // Anti-manipulation: auto-HOLD listings priced far from FMV for review.
    let status: 'ACTIVE' | 'HELD' = 'ACTIVE';
    let heldReason: string | null = null;
    if (fmv && fmv.valueUsdc.gt(0)) {
      const deviationBps = price.sub(fmv.valueUsdc).abs().div(fmv.valueUsdc).mul(10000);
      if (deviationBps.gt(this.env.LISTING_FMV_DEVIATION_BPS)) {
        status = 'HELD';
        heldReason = `Price deviates ${deviationBps.toFixed(0)}bps from FMV ${fmv.valueUsdc.toString()}`;
      }
    }

    try {
      const listing = await this.prisma.listing.create({
        data: {
          vaultItemId,
          sellerId: seller.id,
          type,
          priceUsdc: price,
          fmvLowUsdc: fmv?.valueUsdc ?? null,
          fmvHighUsdc: fmv?.valueUsdc ?? null,
          status,
          heldReason,
        },
      });
      await this.audit.log({
        actorId: seller.id,
        entityType: 'Listing',
        entityId: listing.id,
        action: status === 'HELD' ? 'LISTING_HELD' : 'LISTING_CREATED',
        metadata: { vaultItemId, priceUsdc, type, heldReason },
      });
      return listing;
    } catch (err) {
      if ((err as { code?: string }).code === 'P2002') {
        throw new BadRequestException('This item already has an active listing');
      }
      throw err;
    }
  }

  // ---- Review queue (anti-fraud) -------------------------------------------

  async listHeld() {
    return this.prisma.listing.findMany({
      where: { status: 'HELD' },
      include: {
        vaultItem: { include: { physicalCard: true } },
        seller: { select: { id: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async reviewListing(actor: User, listingId: string, approve: boolean) {
    const listing = await this.prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing) throw new NotFoundException('Listing not found');
    if (listing.status !== 'HELD') throw new BadRequestException('Listing is not held');
    const next = approve ? 'ACTIVE' : 'CANCELLED';
    const updated = await this.prisma.listing.update({
      where: { id: listingId },
      data: { status: next, heldReason: approve ? null : listing.heldReason },
    });
    await this.audit.log({
      actorId: actor.id,
      entityType: 'Listing',
      entityId: listingId,
      action: approve ? 'LISTING_APPROVED' : 'LISTING_REJECTED',
      fromState: 'HELD',
      toState: next,
    });
    return updated;
  }

  async cancelListing(actor: User, listingId: string) {
    const listing = await this.prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing) throw new NotFoundException('Listing not found');
    const staff = actor.role === 'ADMIN' || actor.role === 'OPS';
    if (listing.sellerId !== actor.id && !staff) throw new ForbiddenException('Not your listing');
    if (listing.status !== 'ACTIVE') throw new BadRequestException('Listing is not active');

    const updated = await this.prisma.listing.update({
      where: { id: listingId },
      data: { status: 'CANCELLED' },
    });
    await this.audit.log({
      actorId: actor.id,
      entityType: 'Listing',
      entityId: listingId,
      action: 'LISTING_CANCELLED',
    });
    return updated;
  }

  // ---- Browse ---------------------------------------------------------------

  async browse(params: { category?: string; search?: string; take?: number; skip?: number }) {
    const take = Math.min(params.take ?? 30, 60);
    const card: Prisma.PhysicalCardWhereInput = {
      ...(params.category ? { category: params.category as CardCategory } : {}),
      ...(params.search ? { cardName: { contains: params.search, mode: 'insensitive' } } : {}),
    };
    const where: Prisma.ListingWhereInput = {
      status: 'ACTIVE',
      vaultItem: { state: 'VAULTED', physicalCard: card },
    };
    const [items, total] = await Promise.all([
      this.prisma.listing.findMany({
        where,
        include: {
          vaultItem: { include: { physicalCard: { include: { photos: true } } } },
          seller: { select: { id: true, displayName: true } },
        },
        orderBy: { createdAt: 'desc' },
        take,
        skip: params.skip ?? 0,
      }),
      this.prisma.listing.count({ where }),
    ]);
    return { items, total };
  }

  async getListing(id: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id },
      include: {
        vaultItem: { include: { physicalCard: { include: { photos: true } }, token: true } },
        seller: { select: { id: true, displayName: true } },
      },
    });
    if (!listing) throw new NotFoundException('Listing not found');
    return listing;
  }

  // ---- Buy (the money path) -------------------------------------------------

  /**
   * Purchase a listing with custodial USDC. Atomic: order + double-entry ledger
   * (2% fee split) + ownership move + listing closed. Idempotent on the supplied
   * key. On-chain cNFT reflection is best-effort and recorded when it settles.
   */
  async buy(buyer: User, listingId: string, idempotencyKey: string): Promise<Order> {
    if (buyer.hold === 'SUSPENDED') throw new ForbiddenException('Account suspended');

    // Idempotency: replaying the same key returns the original order.
    const existing = await this.prisma.order.findUnique({ where: { idempotencyKey } });
    if (existing) return existing;

    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      include: { vaultItem: { include: { token: true } } },
    });
    if (!listing) throw new NotFoundException('Listing not found');
    if (listing.status !== 'ACTIVE') throw new BadRequestException('Listing is no longer active');
    if (listing.sellerId === buyer.id)
      throw new BadRequestException('You cannot buy your own listing');

    const item = listing.vaultItem;
    if (item.state !== 'VAULTED' || !item.token || item.token.status !== 'ACTIVE') {
      throw new BadRequestException('Backing token is not vaulted/active');
    }

    const price = listing.priceUsdc;
    const feeBps = this.env.MARKETPLACE_FEE_BPS;
    const fee = price.mul(feeBps).div(10000).toDecimalPlaces(6, Prisma.Decimal.ROUND_DOWN);
    const proceeds = price.sub(fee);

    const balance = await this.ledger.balanceOf(buyer.id);
    if (balance.lt(price)) {
      throw new BadRequestException(
        `Insufficient USDC balance: have ${balance.toString()}, need ${price.toString()}`,
      );
    }

    const sellerId = listing.sellerId;
    const tokenId = item.token.id;

    const order = await this.prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          type: 'MARKETPLACE_BUY',
          status: 'PROCESSING',
          buyerId: buyer.id,
          sellerId,
          listingId,
          amountUsdc: price,
          feeUsdc: fee,
          idempotencyKey,
        },
      });

      await this.ledger.post(tx, created.id, [
        {
          accountType: 'USER_WALLET',
          userId: buyer.id,
          direction: 'DEBIT',
          amountUsdc: price,
          memo: 'Marketplace purchase',
        },
        {
          accountType: 'USER_WALLET',
          userId: sellerId,
          direction: 'CREDIT',
          amountUsdc: proceeds,
          memo: 'Sale proceeds',
        },
        {
          accountType: 'FEE_REVENUE',
          direction: 'CREDIT',
          amountUsdc: fee,
          memo: 'Marketplace fee',
        },
      ]);

      // Move beneficial ownership (authoritative) + close the listing.
      await tx.listing.update({ where: { id: listingId }, data: { status: 'SOLD' } });
      await tx.token.update({ where: { id: tokenId }, data: { ownerId: buyer.id } });
      await tx.vaultItem.update({ where: { id: item.id }, data: { ownerId: buyer.id } });
      // Reputation: a completed sale lifts the seller's score (anti-Sybil signal).
      await tx.user.update({
        where: { id: sellerId },
        data: { reputationScore: { increment: 1 } },
      });

      return created;
    });

    // Reflect on-chain (best-effort; DB ownership already stands).
    let onchainSignature: string | null = null;
    try {
      const sellerWallet = (await this.prisma.user.findUnique({ where: { id: sellerId } }))
        ?.walletAddress;
      if (sellerWallet && buyer.walletAddress && this.transferrer.isConfigured) {
        const res = await this.transferrer.transfer({
          assetId: item.token.cnftAssetId,
          fromWallet: sellerWallet,
          toWallet: buyer.walletAddress,
        });
        onchainSignature = res?.signature ?? null;
      }
    } catch (err) {
      this.logger.error(
        `On-chain transfer failed for order ${order.id}: ${(err as Error).message}`,
      );
    }

    const finalized = await this.prisma.order.update({
      where: { id: order.id },
      data: { status: 'COMPLETED', onchainSignature },
    });

    await this.audit.log({
      actorId: buyer.id,
      entityType: 'Order',
      entityId: order.id,
      action: 'MARKETPLACE_PURCHASE',
      metadata: {
        listingId,
        priceUsdc: price.toString(),
        feeUsdc: fee.toString(),
        sellerId,
        onchainSignature,
        settlement: onchainSignature ? 'on-chain' : 'deferred',
      },
    });

    return finalized;
  }

  // ---- Wallet / portfolio ---------------------------------------------------

  async wallet(userId: string) {
    const [balance, holdings, orders] = await Promise.all([
      this.ledger.balanceOf(userId),
      this.prisma.token.findMany({
        where: { ownerId: userId, status: 'ACTIVE' },
        include: { vaultItem: { include: { physicalCard: { include: { photos: true } } } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.order.findMany({
        where: { OR: [{ buyerId: userId }, { sellerId: userId }] },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ]);
    return { balanceUsdc: balance.toString(), holdings, orders };
  }

  /** Devnet on-ramp: credit a user's custodial USDC balance (staff only). */
  async creditBalance(actor: User, userId: string, amountUsdc: string) {
    const amount = new Prisma.Decimal(amountUsdc);
    if (amount.lte(0)) throw new BadRequestException('Amount must be greater than zero');
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          type: 'DEPOSIT',
          status: 'COMPLETED',
          buyerId: userId,
          amountUsdc: amount,
          idempotencyKey: `deposit_${randomUUID()}`,
        },
      });
      await this.ledger.post(tx, order.id, [
        {
          accountType: 'EXTERNAL',
          direction: 'DEBIT',
          amountUsdc: amount,
          memo: 'On-ramp deposit',
        },
        {
          accountType: 'USER_WALLET',
          userId,
          direction: 'CREDIT',
          amountUsdc: amount,
          memo: 'Deposit',
        },
      ]);
    });

    await this.audit.log({
      actorId: actor.id,
      entityType: 'User',
      entityId: userId,
      action: 'BALANCE_CREDITED',
      metadata: { amountUsdc },
    });
    return { balanceUsdc: (await this.ledger.balanceOf(userId)).toString() };
  }
}
