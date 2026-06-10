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
  type AccountHold,
  type KycStatus,
  type PrismaClient,
  type User,
  type UserRole,
} from '@boosters/db';
import { PRISMA } from '../prisma/prisma.module.js';
import { AuditService } from '../audit/audit.service.js';

export interface ListUsersParams {
  search?: string;
  role?: UserRole;
  take?: number;
  skip?: number;
}

export interface ReferralSummary {
  code: string;
  referredBy: { id: string; displayName: string | null; email: string | null } | null;
  stats: {
    joined: number;
    pendingUsdc: string;
    availableUsdc: string;
    paidUsdc: string;
    totalUsdc: string;
  };
  referrals: Array<{
    id: string;
    displayName: string | null;
    email: string | null;
    createdAt: Date;
  }>;
  rewards: Array<{
    id: string;
    eventType: string;
    status: string;
    amountUsdc: string;
    createdAt: Date;
    referredUser: { id: string; displayName: string | null; email: string | null };
  }>;
}

@Injectable()
export class UsersService {
  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    private readonly audit: AuditService,
  ) {}

  async getById(id: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  /** Self-service profile update (display name only). */
  async updateProfile(user: User, displayName: string | null): Promise<User> {
    return this.prisma.user.update({
      where: { id: user.id },
      data: { displayName: displayName?.trim() || null },
    });
  }

  async referralSummary(user: User): Promise<ReferralSummary> {
    const current = await this.ensureReferralCode(user);
    const [referrals, rewards, referredBy] = await Promise.all([
      this.prisma.user.findMany({
        where: { referredById: current.id },
        select: { id: true, displayName: true, email: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      this.prisma.referralReward.findMany({
        where: { referrerId: current.id },
        include: {
          referredUser: { select: { id: true, displayName: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      current.referredById
        ? this.prisma.user.findUnique({
            where: { id: current.referredById },
            select: { id: true, displayName: true, email: true },
          })
        : null,
    ]);

    const pendingUsdc = sumReferralRewards(rewards, 'PENDING');
    const availableUsdc = sumReferralRewards(rewards, 'AVAILABLE');
    const paidUsdc = sumReferralRewards(rewards, 'PAID');

    return {
      code: current.referralCode!,
      referredBy,
      stats: {
        joined: referrals.length,
        pendingUsdc: pendingUsdc.toString(),
        availableUsdc: availableUsdc.toString(),
        paidUsdc: paidUsdc.toString(),
        totalUsdc: pendingUsdc.add(availableUsdc).add(paidUsdc).toString(),
      },
      referrals,
      rewards: rewards.map((reward) => ({
        id: reward.id,
        eventType: reward.eventType,
        status: reward.status,
        amountUsdc: reward.amountUsdc.toString(),
        createdAt: reward.createdAt,
        referredUser: reward.referredUser,
      })),
    };
  }

  async applyReferralCode(user: User, rawCode: string): Promise<ReferralSummary> {
    const code = normalizeReferralCode(rawCode);
    if (!code) throw new BadRequestException('Referral code is required');

    const current = await this.ensureReferralCode(user);
    if (current.referralCode === code) {
      throw new BadRequestException('You cannot use your own referral code');
    }
    if (current.referredById) return this.referralSummary(current);

    const referrer = await this.prisma.user.findUnique({ where: { referralCode: code } });
    if (!referrer) throw new NotFoundException('Referral code not found');
    if (referrer.id === current.id) throw new BadRequestException('You cannot refer yourself');

    const updated = await this.prisma.user.update({
      where: { id: current.id },
      data: { referredById: referrer.id },
    });
    await this.audit.log({
      actorId: current.id,
      entityType: 'User',
      entityId: current.id,
      action: 'REFERRAL_APPLIED',
      metadata: { referrerId: referrer.id, code },
    });

    return this.referralSummary(updated);
  }

  // ---- Admin / ops operations (each audited) -------------------------------

  async list(params: ListUsersParams) {
    const take = Math.min(params.take ?? 50, 100);
    const where = {
      ...(params.role ? { role: params.role } : {}),
      ...(params.search
        ? {
            OR: [
              { email: { contains: params.search, mode: 'insensitive' as const } },
              { displayName: { contains: params.search, mode: 'insensitive' as const } },
              { walletAddress: { contains: params.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        take,
        skip: params.skip ?? 0,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items, total };
  }

  async setRole(actor: User, targetId: string, role: UserRole): Promise<User> {
    const target = await this.getById(targetId);
    if (actor.id === target.id && role !== 'ADMIN') {
      // Prevent an admin from accidentally locking themselves out.
      throw new ForbiddenException('You cannot remove your own ADMIN role');
    }
    const updated = await this.prisma.user.update({ where: { id: targetId }, data: { role } });
    await this.audit.log({
      actorId: actor.id,
      entityType: 'User',
      entityId: targetId,
      action: 'ROLE_CHANGED',
      fromState: target.role,
      toState: role,
    });
    return updated;
  }

  async setKyc(actor: User, targetId: string, status: KycStatus): Promise<User> {
    const target = await this.getById(targetId);
    const updated = await this.prisma.user.update({
      where: { id: targetId },
      data: { kycStatus: status },
    });
    await this.audit.log({
      actorId: actor.id,
      entityType: 'User',
      entityId: targetId,
      action: 'KYC_STATUS_CHANGED',
      fromState: target.kycStatus,
      toState: status,
    });
    return updated;
  }

  async setHold(actor: User, targetId: string, hold: AccountHold): Promise<User> {
    const target = await this.getById(targetId);
    const updated = await this.prisma.user.update({
      where: { id: targetId },
      data: { hold },
    });
    await this.audit.log({
      actorId: actor.id,
      entityType: 'User',
      entityId: targetId,
      action: 'HOLD_CHANGED',
      fromState: target.hold,
      toState: hold,
    });
    return updated;
  }

  private async ensureReferralCode(user: User): Promise<User> {
    if (user.referralCode) return user;

    for (let attempt = 0; attempt < 8; attempt += 1) {
      try {
        return await this.prisma.user.update({
          where: { id: user.id },
          data: { referralCode: `BST-${randomBytes(4).toString('hex').toUpperCase()}` },
        });
      } catch (error) {
        if (isUniqueConstraint(error)) continue;
        throw error;
      }
    }
    throw new BadRequestException('Could not allocate referral code');
  }
}

function normalizeReferralCode(code: string): string {
  return code
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '')
    .slice(0, 32);
}

function sumReferralRewards(
  rewards: Array<{ status: string; amountUsdc: Prisma.Decimal }>,
  status: string,
): Prisma.Decimal {
  return rewards
    .filter((reward) => reward.status === status)
    .reduce((total, reward) => total.add(reward.amountUsdc), new Prisma.Decimal(0));
}

function isUniqueConstraint(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}
