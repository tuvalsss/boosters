import { Inject, Injectable, Logger } from '@nestjs/common';
import type { PrismaClient, User } from '@boosters/db';
import { adminBootstrapEmails, type Env } from '@boosters/config';
import { ENV } from '../config/config.module.js';
import { PRISMA } from '../prisma/prisma.module.js';
import { AuditService } from '../audit/audit.service.js';
import { PrivyService, extractPrivyIdentity } from './privy.service.js';

/**
 * Maps a verified Privy identity to a durable DB `User`. Real persistence —
 * no mock users. The first time a Privy DID is seen we fetch the full profile
 * from Privy and create the record; subsequent requests load straight from the
 * DB (fast, and avoids Privy rate limits).
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    @Inject(ENV) private readonly env: Env,
    private readonly privy: PrivyService,
    private readonly audit: AuditService,
  ) {}

  /** Resolve (and lazily provision) the DB user behind a verified Privy DID. */
  async syncUser(privyId: string): Promise<User> {
    const existing = await this.prisma.user.findUnique({ where: { privyId } });
    if (existing) return existing;

    // First login for this DID — pull the real profile from Privy.
    const profile = await this.privy.getUser(privyId);
    const { email, solanaWallet } = extractPrivyIdentity(profile);

    const isBootstrapAdmin = email
      ? adminBootstrapEmails(this.env).has(email.toLowerCase())
      : false;

    const user = await this.prisma.user.create({
      data: {
        privyId,
        email,
        walletAddress: solanaWallet,
        role: isBootstrapAdmin ? 'ADMIN' : 'USER',
        // New accounts start held (anti-fraud, spec §7) unless bootstrapped admin.
        hold: isBootstrapAdmin ? 'NONE' : 'NEW_ACCOUNT',
      },
    });

    await this.audit.log({
      actorId: user.id,
      entityType: 'User',
      entityId: user.id,
      action: 'USER_CREATED',
      metadata: { privyId, viaBootstrapAdmin: isBootstrapAdmin },
    });
    if (isBootstrapAdmin) {
      this.logger.log(`Bootstrapped ADMIN for ${email}`);
    }

    return user;
  }
}
