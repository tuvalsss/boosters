import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { AccountHold, KycStatus, PrismaClient, User, UserRole } from '@boosters/db';
import { PRISMA } from '../prisma/prisma.module.js';
import { AuditService } from '../audit/audit.service.js';

export interface ListUsersParams {
  search?: string;
  role?: UserRole;
  take?: number;
  skip?: number;
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
}
