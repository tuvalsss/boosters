import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  type PrismaClient,
  type Redemption,
  type RedemptionStatus,
  type User,
} from '@boosters/db';
import { PRISMA } from '../prisma/prisma.module.js';
import { AuditService } from '../audit/audit.service.js';
import { CNFT_BURNER, type CnftBurner } from './cnft-burner.js';

/**
 * Redeem / claim (spec §6). Burns the token (irreversibly ending the custody
 * gate), releases the physical from the vault, and opens a shipping record the
 * user can track. A burned token can never be re-listed.
 */
@Injectable()
export class RedeemService {
  private readonly logger = new Logger(RedeemService.name);

  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    @Inject(CNFT_BURNER) private readonly burner: CnftBurner,
    private readonly audit: AuditService,
  ) {}

  async redeem(
    user: User,
    vaultItemId: string,
    shippingAddress: Prisma.InputJsonValue,
  ): Promise<Redemption> {
    const item = await this.prisma.vaultItem.findUnique({
      where: { id: vaultItemId },
      include: { token: true, owner: true, listings: { where: { status: 'ACTIVE' } } },
    });
    if (!item) throw new NotFoundException('Vault item not found');
    if (item.ownerId !== user.id) throw new ForbiddenException('You do not own this item');
    if (item.state !== 'VAULTED' || !item.token || item.token.status !== 'ACTIVE') {
      throw new BadRequestException('Item is not a vaulted, active token');
    }
    if (item.listings.length > 0) {
      throw new BadRequestException('Cancel the active listing before redeeming');
    }

    // Burn on-chain best-effort (DB state is authoritative either way).
    let burnSignature: string | null = null;
    try {
      if (this.burner.isConfigured && item.owner.walletAddress) {
        const res = await this.burner.burn({
          assetId: item.token.cnftAssetId,
          ownerWallet: item.owner.walletAddress,
        });
        burnSignature = res?.signature ?? null;
      }
    } catch (err) {
      this.logger.error(`On-chain burn deferred for ${vaultItemId}: ${(err as Error).message}`);
    }

    const tokenId = item.token.id;
    const redemption = await this.prisma.$transaction(async (tx) => {
      await tx.token.update({
        where: { id: tokenId },
        data: { status: 'BURNED', burnedAt: new Date(), burnSignature },
      });
      await tx.vaultItem.update({
        where: { id: vaultItemId },
        data: { state: 'RELEASED', releasedAt: new Date() },
      });
      return tx.redemption.create({
        data: { vaultItemId, userId: user.id, status: 'REQUESTED', shippingAddress },
      });
    });

    await this.audit.log({
      actorId: user.id,
      entityType: 'VaultItem',
      entityId: vaultItemId,
      action: 'REDEEMED_BURNED',
      fromState: 'VAULTED',
      toState: 'RELEASED',
      metadata: { burnSignature, settlement: burnSignature ? 'on-chain' : 'deferred' },
    });
    return redemption;
  }

  listMine(userId: string) {
    return this.prisma.redemption.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { vaultItem: { include: { physicalCard: { include: { photos: true } } } } },
    });
  }

  // ---- Ops ------------------------------------------------------------------

  listForOps(status?: RedemptionStatus) {
    return this.prisma.redemption.findMany({
      where: status ? { status } : {},
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, email: true } },
        vaultItem: { include: { physicalCard: true } },
      },
    });
  }

  async setStatus(
    actor: User,
    id: string,
    status: RedemptionStatus,
    trackingNumber?: string,
  ): Promise<Redemption> {
    const redemption = await this.prisma.redemption.findUnique({ where: { id } });
    if (!redemption) throw new NotFoundException('Redemption not found');
    const updated = await this.prisma.redemption.update({
      where: { id },
      data: { status, ...(trackingNumber ? { trackingNumber } : {}) },
    });
    await this.audit.log({
      actorId: actor.id,
      entityType: 'Redemption',
      entityId: id,
      action: 'REDEMPTION_STATUS',
      fromState: redemption.status,
      toState: status,
      metadata: trackingNumber ? { trackingNumber } : {},
    });
    return updated;
  }
}
