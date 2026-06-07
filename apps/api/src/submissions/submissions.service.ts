import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import {
  Prisma,
  type PrismaClient,
  type Submission,
  type SubmissionStatus,
  type User,
} from '@boosters/db';
import { PRISMA } from '../prisma/prisma.module.js';
import { AuditService } from '../audit/audit.service.js';
import { VaultService } from '../vault/vault.service.js';
import type { CreateSubmissionDto, ReceiveDto } from './submissions.dto.js';

/**
 * Consignment flow (spec §6). A user declares a card, ships it in; once ops
 * receive + authenticate + grade + photograph it, a cNFT is minted to the
 * USER's wallet via the vault state machine, making it tradeable. Every step
 * appends a SubmissionEvent so the user sees a full status timeline.
 */
@Injectable()
export class SubmissionsService {
  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    private readonly vault: VaultService,
    private readonly audit: AuditService,
  ) {}

  private async addEvent(submissionId: string, status: SubmissionStatus, note?: string) {
    await this.prisma.submissionEvent.create({
      data: { submissionId, status, note: note ?? null },
    });
  }

  private async advance(
    actor: User,
    submission: Submission,
    status: SubmissionStatus,
    note?: string,
    extra?: Prisma.SubmissionUpdateInput,
  ): Promise<Submission> {
    const updated = await this.prisma.submission.update({
      where: { id: submission.id },
      data: { status, ...(extra ?? {}) },
    });
    await this.addEvent(submission.id, status, note);
    await this.audit.log({
      actorId: actor.id,
      entityType: 'Submission',
      entityId: submission.id,
      action: 'SUBMISSION_STATUS',
      fromState: submission.status,
      toState: status,
      metadata: note ? { note } : {},
    });
    return updated;
  }

  // ---- User-facing ----------------------------------------------------------

  async create(user: User, dto: CreateSubmissionDto): Promise<Submission> {
    // KYC is required for consignment (spec §7).
    if (user.kycStatus !== 'APPROVED') {
      throw new ForbiddenException('Identity verification (KYC) is required to consign a card');
    }
    const submission = await this.prisma.submission.create({
      data: {
        userId: user.id,
        status: 'DRAFT',
        declaredCard: dto as unknown as Prisma.InputJsonValue,
      },
    });
    await this.addEvent(submission.id, 'DRAFT', 'Submission created');
    return submission;
  }

  async listMine(userId: string) {
    return this.prisma.submission.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { events: { orderBy: { createdAt: 'asc' } } },
    });
  }

  async get(user: User, id: string) {
    const submission = await this.prisma.submission.findUnique({
      where: { id },
      include: {
        events: { orderBy: { createdAt: 'asc' } },
        vaultItem: { include: { physicalCard: { include: { photos: true } }, token: true } },
      },
    });
    if (!submission) throw new NotFoundException('Submission not found');
    const staff = user.role === 'ADMIN' || user.role === 'OPS';
    if (submission.userId !== user.id && !staff)
      throw new ForbiddenException('Not your submission');
    return submission;
  }

  private async owned(user: User, id: string): Promise<Submission> {
    const submission = await this.prisma.submission.findUnique({ where: { id } });
    if (!submission) throw new NotFoundException('Submission not found');
    if (submission.userId !== user.id) throw new ForbiddenException('Not your submission');
    return submission;
  }

  /** Generate prepaid-shipping instructions + a reference code for the user. */
  async generateLabel(user: User, id: string): Promise<Submission> {
    const submission = await this.owned(user, id);
    if (submission.status !== 'DRAFT') {
      throw new BadRequestException('A label has already been generated');
    }
    const ref = `BST-${randomBytes(4).toString('hex').toUpperCase()}`;
    return this.advance(user, submission, 'LABEL_GENERATED', `Ship with reference ${ref}`, {
      shippingLabelUrl: `ref:${ref}`,
    });
  }

  async markShipped(user: User, id: string, trackingNumber: string): Promise<Submission> {
    const submission = await this.owned(user, id);
    if (submission.status !== 'LABEL_GENERATED') {
      throw new BadRequestException('Generate a shipping label first');
    }
    return this.advance(user, submission, 'IN_TRANSIT', `Tracking ${trackingNumber}`, {
      trackingNumber,
    });
  }

  async cancel(user: User, id: string): Promise<Submission> {
    const submission = await this.owned(user, id);
    if (
      ['MINTED', 'RECEIVED', 'AUTHENTICATING', 'GRADING', 'PHOTOGRAPHED'].includes(
        submission.status,
      )
    ) {
      throw new BadRequestException('Submission is already in processing and cannot be cancelled');
    }
    return this.advance(user, submission, 'CANCELLED', 'Cancelled by user');
  }

  // ---- Ops-facing -----------------------------------------------------------

  async listForOps(status?: SubmissionStatus) {
    return this.prisma.submission.findMany({
      where: status ? { status } : {},
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, email: true, walletAddress: true } },
        events: { orderBy: { createdAt: 'asc' } },
        vaultItem: { include: { physicalCard: true, token: true } },
      },
    });
  }

  private async opsLoad(id: string): Promise<Submission> {
    const submission = await this.prisma.submission.findUnique({ where: { id } });
    if (!submission) throw new NotFoundException('Submission not found');
    return submission;
  }

  /** Physical received: create the vault item owned by the submitter, link it. */
  async receive(actor: User, id: string, dto: ReceiveDto): Promise<Submission> {
    const submission = await this.opsLoad(id);
    if (submission.vaultItemId) throw new BadRequestException('Already received');
    if (submission.status === 'CANCELLED' || submission.status === 'REJECTED') {
      throw new BadRequestException(`Submission is ${submission.status}`);
    }

    const item = await this.vault.createIntake(actor, {
      category: dto.category,
      grader: dto.grader,
      cardName: dto.cardName,
      setName: dto.setName,
      year: dto.year,
      certNumber: dto.certNumber,
      ownerId: submission.userId, // mint will target the submitter
    });

    return this.advance(actor, submission, 'RECEIVED', 'Card received at vault', {
      vaultItem: { connect: { id: item.id } },
    });
  }

  async authenticate(actor: User, id: string): Promise<Submission> {
    const submission = await this.requireVaultItem(id);
    await this.vault.startAuthentication(actor, submission.vaultItemId!);
    return this.advance(actor, submission, 'AUTHENTICATING', 'Authentication started');
  }

  async grade(actor: User, id: string, grade: string): Promise<Submission> {
    const submission = await this.requireVaultItem(id);
    await this.vault.setGrade(actor, submission.vaultItemId!, grade);
    return this.advance(actor, submission, 'GRADING', `Graded ${grade}`);
  }

  async addPhotos(actor: User, id: string, urls: string[]): Promise<Submission> {
    const submission = await this.requireVaultItem(id);
    const item = await this.vault.findItem(submission.vaultItemId!);
    await this.prisma.cardPhoto.createMany({
      data: urls.map((url) => ({ physicalCardId: item.physicalCardId, url })),
    });
    return this.advance(actor, submission, 'PHOTOGRAPHED', `${urls.length} photo(s) added`);
  }

  /** Mint the cNFT to the submitter's wallet and mark the submission complete. */
  async mint(actor: User, id: string): Promise<Submission> {
    const submission = await this.requireVaultItem(id);
    await this.vault.vault(actor, submission.vaultItemId!); // GRADED → VAULTED + mint
    return this.advance(actor, submission, 'MINTED', 'Token minted to your wallet');
  }

  async reject(actor: User, id: string, reason: string): Promise<Submission> {
    const submission = await this.opsLoad(id);
    return this.advance(actor, submission, 'REJECTED', reason, { rejectionReason: reason });
  }

  private async requireVaultItem(id: string): Promise<Submission> {
    const submission = await this.opsLoad(id);
    if (!submission.vaultItemId)
      throw new BadRequestException('Submission has not been received yet');
    return submission;
  }
}
