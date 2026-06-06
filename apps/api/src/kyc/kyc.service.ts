import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type { PrismaClient, User } from '@boosters/db';
import type { Env } from '@boosters/config';
import { ENV } from '../config/config.module.js';
import { PRISMA } from '../prisma/prisma.module.js';
import { AuditService } from '../audit/audit.service.js';

export interface KycStartResult {
  status: string;
  provider: string;
  /** What the user must do next. For `manual`, ops review the submission. */
  instructions: string;
}

/**
 * KYC orchestration. The devnet default (`manual`) moves the user to PENDING
 * and waits for a real ops decision in the admin panel — it never auto-approves.
 * Real providers (Veriff/Sumsub) are integrated in Phase 10 and gated behind
 * ENABLE_REAL_KYC.
 */
@Injectable()
export class KycService {
  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    @Inject(ENV) private readonly env: Env,
    private readonly audit: AuditService,
  ) {}

  getStatus(user: User) {
    return { status: user.kycStatus, provider: this.env.KYC_PROVIDER };
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
          ? 'Your verification request has been submitted for manual review by our team.'
          : 'Continue verification with the provider flow.',
    };
  }
}
