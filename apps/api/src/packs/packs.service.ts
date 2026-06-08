import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes, randomUUID } from 'node:crypto';
import { Prisma, type PackOpening, type PrismaClient, type User } from '@boosters/db';
import { PRISMA } from '../prisma/prisma.module.js';
import { AuditService } from '../audit/audit.service.js';
import { LedgerService } from '../ledger/ledger.service.js';
import { CNFT_TRANSFERRER, type CnftTransferrer } from '../marketplace/cnft-transferrer.js';
import { commitmentHash, draw, DRAW_ALGORITHM, type PoolCandidate } from './pack-fairness.js';

interface OddsConfig {
  weights?: Record<string, number>;
}

interface PackVisualInput {
  description?: string;
  brandLabel?: string;
  coverImageUrl?: string;
  accentColor?: string;
  tier?: string;
}

@Injectable()
export class PacksService {
  private readonly logger = new Logger(PacksService.name);

  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    @Inject(CNFT_TRANSFERRER) private readonly transferrer: CnftTransferrer,
    private readonly ledger: LedgerService,
    private readonly audit: AuditService,
  ) {}

  private weightOf(odds: OddsConfig, tier: string | null): number {
    const w = odds.weights?.[tier ?? 'default'];
    return typeof w === 'number' && w > 0 ? w : 1;
  }

  // ---- Admin ----------------------------------------------------------------

  async createPack(
    actor: User,
    name: string,
    priceUsdc: string,
    weights?: Record<string, number>,
    visual?: PackVisualInput,
  ) {
    const pack = await this.prisma.pack.create({
      data: {
        name,
        description: visual?.description?.trim() || null,
        priceUsdc: new Prisma.Decimal(priceUsdc),
        brandLabel: visual?.brandLabel?.trim() || 'BOOSTERS',
        coverImageUrl: visual?.coverImageUrl?.trim() || null,
        accentColor: visual?.accentColor?.trim() || '#22c55e',
        tier: visual?.tier?.trim().toUpperCase() || 'CORE',
        oddsConfig: { weights: weights ?? {} } as Prisma.InputJsonValue,
        status: 'DRAFT',
      },
    });
    await this.audit.log({
      actorId: actor.id,
      entityType: 'Pack',
      entityId: pack.id,
      action: 'PACK_CREATED',
    });
    return pack;
  }

  async updateVisual(actor: User, packId: string, visual: PackVisualInput) {
    const pack = await this.prisma.pack.update({
      where: { id: packId },
      data: {
        ...(visual.description !== undefined
          ? { description: visual.description.trim() || null }
          : {}),
        ...(visual.brandLabel !== undefined
          ? { brandLabel: visual.brandLabel.trim() || 'BOOSTERS' }
          : {}),
        ...(visual.coverImageUrl !== undefined
          ? { coverImageUrl: visual.coverImageUrl.trim() || null }
          : {}),
        ...(visual.accentColor !== undefined
          ? { accentColor: visual.accentColor.trim() || '#22c55e' }
          : {}),
        ...(visual.tier !== undefined ? { tier: visual.tier.trim().toUpperCase() || 'CORE' } : {}),
      },
    });
    await this.audit.log({
      actorId: actor.id,
      entityType: 'Pack',
      entityId: packId,
      action: 'PACK_VISUAL_UPDATED',
      metadata: {
        brandLabel: pack.brandLabel,
        tier: pack.tier,
        coverImageUrl: pack.coverImageUrl,
        accentColor: pack.accentColor,
      },
    });
    return pack;
  }

  async addPoolItem(actor: User, packId: string, vaultItemId: string, tier?: string) {
    const item = await this.prisma.vaultItem.findUnique({
      where: { id: vaultItemId },
      include: { token: true },
    });
    if (!item) throw new NotFoundException('Vault item not found');
    if (item.state !== 'VAULTED' || !item.token || item.token.status !== 'ACTIVE') {
      throw new BadRequestException('Only vaulted, active tokens can be added to a pack');
    }
    try {
      const poolItem = await this.prisma.packPoolItem.create({
        data: { packId, vaultItemId, tier: tier ?? 'default' },
      });
      await this.audit.log({
        actorId: actor.id,
        entityType: 'Pack',
        entityId: packId,
        action: 'POOL_ITEM_ADDED',
        metadata: { vaultItemId },
      });
      return poolItem;
    } catch (err) {
      if ((err as { code?: string }).code === 'P2002') {
        throw new BadRequestException('Item is already in a pack');
      }
      throw err;
    }
  }

  async setStatus(actor: User, packId: string, status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED') {
    const pack = await this.prisma.pack.update({ where: { id: packId }, data: { status } });
    await this.audit.log({
      actorId: actor.id,
      entityType: 'Pack',
      entityId: packId,
      action: 'PACK_STATUS',
      toState: status,
    });
    return pack;
  }

  /** All packs (admin), including drafts, with pool counts. */
  async listAll() {
    return this.prisma.pack.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { poolItems: true } } },
    });
  }

  // ---- Public reads (transparent odds + pool) -------------------------------

  async listActive() {
    const packs = await this.prisma.pack.findMany({
      where: { status: 'ACTIVE' },
      include: { _count: { select: { poolItems: { where: { consumed: false } } } } },
      orderBy: { createdAt: 'desc' },
    });
    return packs;
  }

  async getPack(id: string) {
    const pack = await this.prisma.pack.findUnique({
      where: { id },
      include: {
        poolItems: {
          include: { vaultItem: { include: { physicalCard: { include: { photos: true } } } } },
        },
      },
    });
    if (!pack) throw new NotFoundException('Pack not found');

    const odds = pack.oddsConfig as OddsConfig;
    const available = pack.poolItems.filter((p) => !p.consumed);
    const totalWeight = available.reduce((s, p) => s + this.weightOf(odds, p.tier), 0);
    const pool = pack.poolItems.map((p) => ({
      poolItemId: p.id,
      tier: p.tier,
      consumed: p.consumed,
      weight: this.weightOf(odds, p.tier),
      oddsPct:
        !p.consumed && totalWeight > 0
          ? Number(((this.weightOf(odds, p.tier) / totalWeight) * 100).toFixed(2))
          : 0,
      card: p.vaultItem.physicalCard,
    }));
    return {
      id: pack.id,
      name: pack.name,
      description: pack.description,
      brandLabel: pack.brandLabel,
      coverImageUrl: pack.coverImageUrl,
      accentColor: pack.accentColor,
      tier: pack.tier,
      priceUsdc: pack.priceUsdc.toString(),
      status: pack.status,
      remaining: available.length,
      pool,
    };
  }

  // ---- Commit / reveal (provably fair) --------------------------------------

  /** Commit phase: pay, fix + hash a server seed, publish the commitment. */
  async commit(user: User, packId: string, clientSeed?: string): Promise<PackOpening> {
    if (user.hold === 'SUSPENDED') throw new ForbiddenException('Account suspended');
    const pack = await this.prisma.pack.findUnique({ where: { id: packId } });
    if (!pack || pack.status !== 'ACTIVE') throw new BadRequestException('Pack is not active');

    const available = await this.prisma.packPoolItem.count({ where: { packId, consumed: false } });
    if (available === 0) throw new BadRequestException('Pack is sold out');

    const balance = await this.ledger.balanceOf(user.id);
    if (balance.lt(pack.priceUsdc)) {
      throw new BadRequestException(
        `Insufficient USDC balance: have ${balance.toString()}, need ${pack.priceUsdc.toString()}`,
      );
    }

    const serverSeed = randomBytes(32).toString('hex');
    const serverSeedHash = commitmentHash(serverSeed);
    const seed = clientSeed?.trim() || randomBytes(8).toString('hex');

    const opening = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          type: 'PACK_PURCHASE',
          status: 'COMPLETED',
          buyerId: user.id,
          amountUsdc: pack.priceUsdc,
          idempotencyKey: `pack_${randomUUID()}`,
        },
      });
      await this.ledger.post(tx, order.id, [
        {
          accountType: 'USER_WALLET',
          userId: user.id,
          direction: 'DEBIT',
          amountUsdc: pack.priceUsdc,
          memo: 'Pack purchase',
        },
        {
          accountType: 'TREASURY',
          direction: 'CREDIT',
          amountUsdc: pack.priceUsdc,
          memo: 'Pack revenue',
        },
      ]);
      return tx.packOpening.create({
        data: {
          packId,
          userId: user.id,
          serverSeed, // stored hidden; revealed at draw
          serverSeedHash,
          clientSeed: seed,
          status: 'COMMITTED',
          orderId: order.id,
        },
      });
    });

    await this.audit.log({
      actorId: user.id,
      entityType: 'PackOpening',
      entityId: opening.id,
      action: 'PACK_COMMITTED',
      metadata: { packId, serverSeedHash },
    });
    // Never leak the server seed before reveal.
    return { ...opening, serverSeed: null };
  }

  /** Reveal phase: draw with the committed seed + client seed, settle the win. */
  async reveal(user: User, openingId: string, clientSeed?: string): Promise<PackOpening> {
    const opening = await this.prisma.packOpening.findUnique({ where: { id: openingId } });
    if (!opening) throw new NotFoundException('Opening not found');
    if (opening.userId !== user.id) throw new ForbiddenException('Not your opening');
    if (opening.status !== 'COMMITTED') {
      // Idempotent: already revealed.
      return opening;
    }

    const finalClientSeed = clientSeed?.trim() || opening.clientSeed;

    const candidates: PoolCandidate[] = await this.candidatesFor(opening.packId);
    if (candidates.length === 0) throw new BadRequestException('Pack is sold out');

    const result = draw(opening.serverSeed!, finalClientSeed, opening.nonce, candidates);

    // Capture the current (pre-transfer) owner for the on-chain reflection.
    const winnerToken = await this.prisma.token.findUnique({
      where: { vaultItemId: result.winner.vaultItemId },
      include: { owner: true },
    });
    const fromWallet = winnerToken?.owner.walletAddress ?? null;

    const proof = {
      algorithm: DRAW_ALGORITHM,
      candidates,
      floatHex: result.floatHex,
      float: result.float,
      index: result.index,
    };

    const settled = await this.prisma.$transaction(async (tx) => {
      // Consume the won pool item and mark the opening revealed/settled.
      await tx.packPoolItem.update({
        where: { id: result.winner.poolItemId },
        data: { consumed: true },
      });
      const updated = await tx.packOpening.update({
        where: { id: openingId },
        data: {
          clientSeed: finalClientSeed,
          resultVaultItemId: result.winner.vaultItemId,
          proof: proof as unknown as Prisma.InputJsonValue,
          status: 'SETTLED',
          revealedAt: new Date(),
        },
      });
      // Move beneficial ownership of the won card to the user.
      await tx.token.updateMany({
        where: { vaultItemId: result.winner.vaultItemId },
        data: { ownerId: user.id },
      });
      await tx.vaultItem.update({
        where: { id: result.winner.vaultItemId },
        data: { ownerId: user.id },
      });
      return updated;
    });

    // Best-effort on-chain reflection (DB ownership already authoritative).
    try {
      if (winnerToken && user.walletAddress && fromWallet && this.transferrer.isConfigured) {
        await this.transferrer.transfer({
          assetId: winnerToken.cnftAssetId,
          fromWallet,
          toWallet: user.walletAddress,
        });
      }
    } catch (err) {
      this.logger.error(`Pack on-chain transfer deferred: ${(err as Error).message}`);
    }

    await this.audit.log({
      actorId: user.id,
      entityType: 'PackOpening',
      entityId: openingId,
      action: 'PACK_REVEALED',
      metadata: { resultVaultItemId: result.winner.vaultItemId, floatHex: result.floatHex },
    });
    return settled;
  }

  private async candidatesFor(packId: string): Promise<PoolCandidate[]> {
    const pack = await this.prisma.pack.findUniqueOrThrow({ where: { id: packId } });
    const odds = pack.oddsConfig as OddsConfig;
    const items = await this.prisma.packPoolItem.findMany({
      where: { packId, consumed: false },
      orderBy: { id: 'asc' }, // stable order for reproducible replay
    });
    return items.map((p) => ({
      poolItemId: p.id,
      vaultItemId: p.vaultItemId,
      weight: this.weightOf(odds, p.tier),
    }));
  }

  /** Public verification payload — everything needed to replay the draw. */
  async getOpening(id: string) {
    const opening = await this.prisma.packOpening.findUnique({
      where: { id },
      include: { pack: { select: { id: true, name: true } } },
    });
    if (!opening) throw new NotFoundException('Opening not found');
    const revealed = opening.status === 'SETTLED' || opening.status === 'REVEALED';
    const result = opening.resultVaultItemId
      ? await this.prisma.vaultItem.findUnique({
          where: { id: opening.resultVaultItemId },
          include: { physicalCard: { include: { photos: true } } },
        })
      : null;
    return {
      id: opening.id,
      pack: opening.pack,
      status: opening.status,
      serverSeedHash: opening.serverSeedHash,
      serverSeed: revealed ? opening.serverSeed : null, // only after reveal
      clientSeed: opening.clientSeed,
      nonce: opening.nonce,
      proof: opening.proof,
      resultVaultItemId: opening.resultVaultItemId,
      result,
      revealedAt: opening.revealedAt,
    };
  }
}
