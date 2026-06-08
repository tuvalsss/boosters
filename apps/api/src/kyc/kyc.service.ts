import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, isAbsolute, resolve } from 'node:path';
import {
  KycDocumentType,
  KycIdentityDocumentType,
  KycStatus,
  type PrismaClient,
  type User,
} from '@boosters/db';
import type { Env } from '@boosters/config';
import { ENV } from '../config/config.module.js';
import { PRISMA } from '../prisma/prisma.module.js';
import { AuditService } from '../audit/audit.service.js';

const MAX_DOCUMENTS = 5;
const MAX_DOCUMENT_BYTES = 8 * 1024 * 1024;
const ALLOWED_CONTENT_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);

export interface KycStartResult {
  status: string;
  provider: string;
  /** What the user must do next. For `manual`, ops review the submission. */
  instructions: string;
}

export interface ManualKycDocumentInput {
  type: KycDocumentType;
  fileName: string;
  contentType: string;
  dataUrl: string;
}

export interface ManualKycInput {
  documentType: KycIdentityDocumentType;
  legalName: string;
  country: string;
  notes?: string;
  documents: ManualKycDocumentInput[];
}

export interface KycReviewInput {
  status: KycStatus;
  reviewerNotes?: string;
}

/**
 * KYC orchestration. The default `manual` provider is a real local workflow:
 * users upload identity documents, staff review them in the admin panel, and no
 * money-out path is allowed until the user's KYC status is APPROVED.
 */
@Injectable()
export class KycService {
  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    @Inject(ENV) private readonly env: Env,
    private readonly audit: AuditService,
  ) {}

  async getStatus(user: User) {
    const latest = await this.prisma.kycSubmission.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      include: { documents: { orderBy: { createdAt: 'asc' } } },
    });
    return {
      status: user.kycStatus,
      provider: this.env.KYC_PROVIDER,
      submission: latest ? this.publicSubmission(latest) : null,
    };
  }

  async start(user: User): Promise<KycStartResult> {
    if (user.kycStatus === 'APPROVED') {
      throw new BadRequestException('KYC already approved');
    }

    if (this.env.KYC_PROVIDER !== 'manual' && !this.env.ENABLE_REAL_KYC) {
      throw new BadRequestException(
        `Real KYC provider "${this.env.KYC_PROVIDER}" is disabled. Set ENABLE_REAL_KYC=true (Phase 10).`,
      );
    }

    await this.prisma.user.update({ where: { id: user.id }, data: { kycStatus: 'PENDING' } });
    await this.audit.log({
      actorId: user.id,
      entityType: 'User',
      entityId: user.id,
      action: 'KYC_STARTED',
      fromState: user.kycStatus,
      toState: 'PENDING',
      metadata: { provider: this.env.KYC_PROVIDER },
    });

    return {
      status: 'PENDING',
      provider: this.env.KYC_PROVIDER,
      instructions:
        this.env.KYC_PROVIDER === 'manual'
          ? 'Upload your identity documents. Our team will review them before withdrawals are enabled.'
          : 'Continue verification with the provider flow.',
    };
  }

  async submitManual(user: User, input: ManualKycInput) {
    if (this.env.KYC_PROVIDER !== 'manual') {
      throw new BadRequestException('Manual KYC submission is disabled for this provider');
    }
    if (user.kycStatus === 'APPROVED') {
      throw new BadRequestException('KYC already approved');
    }

    const pending = await this.prisma.kycSubmission.findFirst({
      where: { userId: user.id, status: 'PENDING' },
      select: { id: true },
    });
    if (pending) throw new BadRequestException('A KYC submission is already pending review');

    this.validateManualSubmission(input);

    const submission = await this.prisma.kycSubmission.create({
      data: {
        userId: user.id,
        status: 'PENDING',
        documentType: input.documentType,
        legalName: input.legalName.trim(),
        country: input.country.trim().toUpperCase(),
        notes: input.notes?.trim() || null,
      },
    });

    try {
      const documents = await Promise.all(
        input.documents.map(async (doc) => {
          const decoded = this.decodeDataUrl(doc);
          const extension = this.extensionFor(decoded.contentType, doc.fileName);
          const safeName = `${doc.type.toLowerCase()}-${randomUUID()}${extension}`;
          const storageKey = [user.id, submission.id, safeName].join('/');
          const fullPath = this.pathForStorageKey(storageKey);

          await mkdir(dirname(fullPath), { recursive: true });
          await writeFile(fullPath, decoded.bytes);

          return {
            submissionId: submission.id,
            type: doc.type,
            fileName: basename(doc.fileName).slice(0, 160),
            contentType: decoded.contentType,
            storageKey,
            checksumSha256: createHash('sha256').update(decoded.bytes).digest('hex'),
          };
        }),
      );

      await this.prisma.$transaction(async (tx) => {
        await tx.kycDocument.createMany({ data: documents });
        await tx.user.update({ where: { id: user.id }, data: { kycStatus: 'PENDING' } });
      });
    } catch (err) {
      await this.prisma.kycSubmission.delete({ where: { id: submission.id } }).catch(() => {});
      throw err;
    }

    await this.audit.log({
      actorId: user.id,
      entityType: 'KycSubmission',
      entityId: submission.id,
      action: 'KYC_SUBMITTED',
      toState: 'PENDING',
      metadata: { documentType: input.documentType, country: input.country },
    });

    return this.getSubmissionForUser(user, submission.id);
  }

  async getSubmissionForUser(user: User, id: string) {
    const submission = await this.prisma.kycSubmission.findUnique({
      where: { id },
      include: { documents: { orderBy: { createdAt: 'asc' } }, user: true },
    });
    if (!submission) throw new NotFoundException('KYC submission not found');
    const staff = user.role === 'ADMIN' || user.role === 'OPS';
    if (submission.userId !== user.id && !staff) throw new ForbiddenException('Not your KYC file');
    return this.publicSubmission(submission);
  }

  async listForAdmin(status?: KycStatus) {
    const submissions = await this.prisma.kycSubmission.findMany({
      where: status ? { status } : {},
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      include: {
        user: { select: { id: true, email: true, walletAddress: true, displayName: true } },
        documents: { orderBy: { createdAt: 'asc' } },
      },
    });
    return submissions.map((s) => this.publicSubmission(s));
  }

  async review(actor: User, submissionId: string, input: KycReviewInput) {
    if (input.status !== 'APPROVED' && input.status !== 'REJECTED') {
      throw new BadRequestException('KYC review status must be APPROVED or REJECTED');
    }

    const current = await this.prisma.kycSubmission.findUnique({ where: { id: submissionId } });
    if (!current) throw new NotFoundException('KYC submission not found');

    const updated = await this.prisma.$transaction(async (tx) => {
      const submission = await tx.kycSubmission.update({
        where: { id: submissionId },
        data: {
          status: input.status,
          reviewerNotes: input.reviewerNotes?.trim() || null,
          reviewedById: actor.id,
          reviewedAt: new Date(),
        },
        include: {
          user: { select: { id: true, email: true, walletAddress: true, displayName: true } },
          documents: { orderBy: { createdAt: 'asc' } },
        },
      });
      await tx.user.update({ where: { id: current.userId }, data: { kycStatus: input.status } });
      return submission;
    });

    await this.audit.log({
      actorId: actor.id,
      entityType: 'KycSubmission',
      entityId: submissionId,
      action: input.status === 'APPROVED' ? 'KYC_APPROVED' : 'KYC_REJECTED',
      fromState: current.status,
      toState: input.status,
      metadata: { reviewerNotes: input.reviewerNotes ?? null, userId: current.userId },
    });

    return this.publicSubmission(updated);
  }

  async getDocument(actor: User, documentId: string) {
    const document = await this.prisma.kycDocument.findUnique({
      where: { id: documentId },
      include: { submission: true },
    });
    if (!document) throw new NotFoundException('KYC document not found');
    const staff = actor.role === 'ADMIN' || actor.role === 'OPS';
    if (document.submission.userId !== actor.id && !staff) {
      throw new ForbiddenException('Not your KYC document');
    }
    return {
      path: this.pathForStorageKey(document.storageKey),
      contentType: document.contentType,
      fileName: document.fileName,
    };
  }

  /**
   * Inbound KYC provider webhook (Veriff/Sumsub). HMAC-verified with
   * KYC_WEBHOOK_SECRET. Sets the user's status from the provider decision.
   * Gated behind ENABLE_REAL_KYC.
   */
  async handleWebhook(payload: { userId: string; status: string; signature: string }) {
    if (!this.env.ENABLE_REAL_KYC) {
      throw new BadRequestException('Real KYC is disabled');
    }
    if (this.env.KYC_WEBHOOK_SECRET) {
      const expected = createHmac('sha256', this.env.KYC_WEBHOOK_SECRET)
        .update(`${payload.userId}:${payload.status}`)
        .digest('hex');
      const ok =
        payload.signature.length === expected.length &&
        timingSafeEqual(Buffer.from(payload.signature), Buffer.from(expected));
      if (!ok) throw new UnauthorizedException('Invalid KYC webhook signature');
    }
    const status = (Object.values(KycStatus) as string[]).includes(payload.status)
      ? (payload.status as KycStatus)
      : null;
    if (!status) throw new BadRequestException('Unknown KYC status');

    const user = await this.prisma.user.update({
      where: { id: payload.userId },
      data: { kycStatus: status },
    });
    await this.audit.log({
      entityType: 'User',
      entityId: user.id,
      action: 'KYC_WEBHOOK',
      toState: status,
      metadata: { provider: this.env.KYC_PROVIDER },
    });
    return { status };
  }

  private validateManualSubmission(input: ManualKycInput) {
    if (!input.legalName.trim()) throw new BadRequestException('Legal name is required');
    if (!input.country.trim()) throw new BadRequestException('Country is required');
    if (input.documents.length === 0) throw new BadRequestException('KYC documents are required');
    if (input.documents.length > MAX_DOCUMENTS) {
      throw new BadRequestException(`You can upload up to ${MAX_DOCUMENTS} KYC documents`);
    }

    const provided = new Set(input.documents.map((d) => d.type));
    for (const required of this.requiredDocuments(input.documentType)) {
      if (!provided.has(required)) {
        throw new BadRequestException(`Missing required KYC document: ${required}`);
      }
    }
  }

  private requiredDocuments(documentType: KycIdentityDocumentType): KycDocumentType[] {
    if (documentType === 'PASSPORT') return ['PASSPORT', 'SELFIE'];
    if (documentType === 'DRIVERS_LICENSE') {
      return ['DRIVERS_LICENSE_FRONT', 'DRIVERS_LICENSE_BACK', 'SELFIE'];
    }
    return ['ID_FRONT', 'ID_BACK', 'SELFIE'];
  }

  private decodeDataUrl(doc: ManualKycDocumentInput) {
    const match = /^data:([^;]+);base64,(.+)$/i.exec(doc.dataUrl.trim());
    if (!match) throw new BadRequestException(`${doc.type} must be uploaded as a data URL`);
    const contentType = match[1]!.toLowerCase();
    if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
      throw new BadRequestException(`${doc.type} must be a JPG, PNG, WEBP or PDF`);
    }
    if (doc.contentType && doc.contentType.toLowerCase() !== contentType) {
      throw new BadRequestException(`${doc.type} content type does not match the uploaded file`);
    }

    const bytes = Buffer.from(match[2]!.replace(/\s/g, ''), 'base64');
    if (bytes.length === 0) throw new BadRequestException(`${doc.type} upload is empty`);
    if (bytes.length > MAX_DOCUMENT_BYTES) {
      throw new BadRequestException(`${doc.type} exceeds the 8MB upload limit`);
    }
    return { bytes, contentType };
  }

  private extensionFor(contentType: string, originalName: string) {
    const byType: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'application/pdf': '.pdf',
    };
    return byType[contentType] ?? (extname(originalName).slice(0, 10) || '.bin');
  }

  private uploadRoot() {
    return isAbsolute(this.env.KYC_UPLOAD_DIR)
      ? resolve(this.env.KYC_UPLOAD_DIR)
      : resolve(process.cwd(), this.env.KYC_UPLOAD_DIR);
  }

  private pathForStorageKey(storageKey: string) {
    const root = this.uploadRoot();
    const path = resolve(root, storageKey);
    if (path !== root && !path.startsWith(`${root}\\`) && !path.startsWith(`${root}/`)) {
      throw new BadRequestException('Invalid KYC document path');
    }
    return path;
  }

  private publicSubmission(submission: {
    id: string;
    userId: string;
    status: KycStatus;
    documentType: KycIdentityDocumentType;
    legalName: string;
    country: string;
    notes: string | null;
    reviewerNotes: string | null;
    reviewedById: string | null;
    reviewedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    user?: {
      id: string;
      email: string | null;
      walletAddress: string | null;
      displayName?: string | null;
    };
    documents: {
      id: string;
      type: KycDocumentType;
      fileName: string;
      contentType: string;
      checksumSha256: string;
      createdAt: Date;
    }[];
  }) {
    return {
      id: submission.id,
      userId: submission.userId,
      user: submission.user,
      status: submission.status,
      documentType: submission.documentType,
      legalName: submission.legalName,
      country: submission.country,
      notes: submission.notes,
      reviewerNotes: submission.reviewerNotes,
      reviewedById: submission.reviewedById,
      reviewedAt: submission.reviewedAt,
      createdAt: submission.createdAt,
      updatedAt: submission.updatedAt,
      documents: submission.documents.map((d) => ({
        id: d.id,
        type: d.type,
        fileName: d.fileName,
        contentType: d.contentType,
        checksumSha256: d.checksumSha256,
        createdAt: d.createdAt,
      })),
    };
  }
}
