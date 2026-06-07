import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma, PrismaClient, User, VaultItem, VaultItemState } from '@boosters/db';
import type { Env } from '@boosters/config';
import { ENV } from '../config/config.module.js';
import { PRISMA } from '../prisma/prisma.module.js';
import { AuditService } from '../audit/audit.service.js';
import { CNFT_MINTER, type CnftMinter } from './cnft-minter.js';
import type { CreateIntakeDto } from './vault.dto.js';

/**
 * Allowed vault state transitions (spec §5). Anything not listed here is
 * rejected — the lifecycle is append-only and auditable.
 *   INTAKE → AUTHENTICATING → GRADED → VAULTED → RESERVED → RELEASED
 */
const ALLOWED: Record<VaultItemState, VaultItemState[]> = {
  INTAKE: ['AUTHENTICATING'],
  AUTHENTICATING: ['GRADED'],
  GRADED: ['VAULTED'],
  VAULTED: ['RESERVED', 'RELEASED'],
  RESERVED: ['VAULTED', 'RELEASED'],
  RELEASED: [], // terminal
};

@Injectable()
export class VaultService {
  private readonly logger = new Logger(VaultService.name);

  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    @Inject(ENV) private readonly env: Env,
    @Inject(CNFT_MINTER) private readonly minter: CnftMinter,
    private readonly audit: AuditService,
  ) {}

  // ---- Intake ---------------------------------------------------------------

  /** Create a physical card + its vault record in INTAKE. First-party by default. */
  async createIntake(actor: User, dto: CreateIntakeDto): Promise<VaultItem> {
    const ownerId = dto.ownerId ?? actor.id;
    const owner = await this.prisma.user.findUnique({ where: { id: ownerId } });
    if (!owner) throw new NotFoundException('Owner not found');

    const item = await this.prisma.vaultItem.create({
      data: {
        state: 'INTAKE',
        owner: { connect: { id: ownerId } },
        physicalCard: {
          create: {
            category: dto.category,
            grader: dto.grader,
            cardName: dto.cardName,
            setName: dto.setName ?? null,
            year: dto.year ?? null,
            certNumber: dto.certNumber ?? null,
            grade: dto.grade ?? null,
            attributes: (dto.attributes ?? {}) as Prisma.InputJsonValue,
            ...(dto.photos?.length
              ? {
                  photos: {
                    create: dto.photos.map((p) => ({ url: p.url, kind: p.kind ?? 'front' })),
                  },
                }
              : {}),
          },
        },
      },
    });

    await this.audit.log({
      actorId: actor.id,
      entityType: 'VaultItem',
      entityId: item.id,
      action: 'INTAKE_CREATED',
      toState: 'INTAKE',
      metadata: { ownerId, cardName: dto.cardName },
    });
    return item;
  }

  // ---- State machine --------------------------------------------------------

  async findItem(id: string) {
    const item = await this.prisma.vaultItem.findUnique({
      where: { id },
      include: { physicalCard: { include: { photos: true } }, owner: true, token: true },
    });
    if (!item) throw new NotFoundException('Vault item not found');
    return item;
  }

  private assertTransition(from: VaultItemState, to: VaultItemState) {
    if (!ALLOWED[from].includes(to)) {
      throw new BadRequestException(`Illegal vault transition ${from} → ${to}`);
    }
  }

  async startAuthentication(actor: User, id: string): Promise<VaultItem> {
    return this.simpleTransition(actor, id, 'INTAKE', 'AUTHENTICATING');
  }

  /** Record the grade and advance to GRADED (ready to vault/mint). */
  async setGrade(actor: User, id: string, grade: string): Promise<VaultItem> {
    const item = await this.findItem(id);
    this.assertTransition(item.state, 'GRADED');
    const updated = await this.prisma.vaultItem.update({
      where: { id },
      data: {
        state: 'GRADED',
        physicalCard: { update: { grade } },
      },
    });
    await this.audit.log({
      actorId: actor.id,
      entityType: 'VaultItem',
      entityId: id,
      action: 'GRADED',
      fromState: item.state,
      toState: 'GRADED',
      metadata: { grade },
    });
    return updated;
  }

  private async simpleTransition(
    actor: User,
    id: string,
    expected: VaultItemState,
    to: VaultItemState,
  ): Promise<VaultItem> {
    const item = await this.findItem(id);
    if (item.state !== expected) {
      throw new BadRequestException(`Expected state ${expected}, found ${item.state}`);
    }
    this.assertTransition(item.state, to);
    const updated = await this.prisma.vaultItem.update({ where: { id }, data: { state: to } });
    await this.audit.log({
      actorId: actor.id,
      entityType: 'VaultItem',
      entityId: id,
      action: 'STATE_TRANSITION',
      fromState: item.state,
      toState: to,
    });
    return updated;
  }

  // ---- Vaulting = the custody-gate mint point (spec §3) ---------------------

  /**
   * GRADED → VAULTED. This is the ONLY place a tradeable Token is created, and
   * only after a real cNFT mint backed by the physical card in the vault.
   * Idempotent: a second call after a successful mint is a no-op.
   */
  async vault(actor: User, id: string): Promise<VaultItem> {
    const item = await this.findItem(id);

    // Idempotency: already vaulted + minted.
    if (item.token && item.state === 'VAULTED') return item;
    if (item.token) {
      throw new ConflictException('Vault item already has a token but is not VAULTED');
    }

    this.assertTransition(item.state, 'VAULTED');
    if (!item.owner.walletAddress) {
      throw new BadRequestException('Owner has no Solana wallet to receive the token');
    }
    if (!this.minter.isConfigured) {
      throw new BadRequestException(
        'Minting is not configured (MINT_AUTHORITY_SECRET / MERKLE_TREE_ADDRESS)',
      );
    }

    const metadataUri = `${this.env.PUBLIC_API_URL}/api/metadata/vault/${id}`;
    const name = `${item.physicalCard.cardName}`.slice(0, 32);

    // Mint on-chain first; only persist the Token if it succeeds.
    const mint = await this.minter.mint({
      ownerWallet: item.owner.walletAddress,
      name,
      metadataUri,
    });

    try {
      await this.prisma.$transaction([
        this.prisma.token.create({
          data: {
            vaultItemId: id,
            cnftAssetId: mint.assetId,
            merkleTree: mint.merkleTree,
            leafIndex: mint.leafIndex,
            mintSignature: mint.signature,
            metadataUri,
            ownerId: item.ownerId,
            status: 'ACTIVE',
          },
        }),
        this.prisma.vaultItem.update({ where: { id }, data: { state: 'VAULTED' } }),
      ]);
    } catch (err) {
      // Unique-constraint violation ⇒ a token already exists (double-call race).
      if ((err as { code?: string }).code === 'P2002') {
        this.logger.warn(`Token already recorded for vault item ${id}; treating as idempotent`);
        return this.prisma.vaultItem.update({ where: { id }, data: { state: 'VAULTED' } });
      }
      // Mint happened but DB write failed — surface for manual reconciliation.
      this.logger.error(
        `MINT/DB MISMATCH: minted ${mint.assetId} (sig ${mint.signature}) for vault item ${id} but DB write failed`,
      );
      throw err;
    }

    await this.audit.log({
      actorId: actor.id,
      entityType: 'VaultItem',
      entityId: id,
      action: 'VAULTED_MINTED',
      fromState: 'GRADED',
      toState: 'VAULTED',
      metadata: { assetId: mint.assetId, signature: mint.signature, leafIndex: mint.leafIndex },
    });

    return this.prisma.vaultItem.findUniqueOrThrow({ where: { id } });
  }

  // ---- Queues / reads -------------------------------------------------------

  async listByState(state?: VaultItemState, take = 50, skip = 0) {
    const where = state ? { state } : {};
    const [items, total] = await Promise.all([
      this.prisma.vaultItem.findMany({
        where,
        include: { physicalCard: true, owner: true, token: true },
        orderBy: { createdAt: 'desc' },
        take: Math.min(take, 100),
        skip,
      }),
      this.prisma.vaultItem.count({ where }),
    ]);
    return { items, total };
  }
}
