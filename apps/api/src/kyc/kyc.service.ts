import { BadRequestException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { KycStatus, type PrismaClient, type User } from '@boosters/db';
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
}
