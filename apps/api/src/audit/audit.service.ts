import { Inject, Injectable } from '@nestjs/common';
import type { Prisma, PrismaClient } from '@boosters/db';
import { PRISMA } from '../prisma/prisma.module.js';

export interface AuditEntry {
  actorId?: string | null;
  entityType: string;
  entityId: string;
  action: string;
  fromState?: string | null;
  toState?: string | null;
  metadata?: Prisma.InputJsonValue;
}

/**
 * Append-only audit log for every state transition / privileged action
 * (spec §7 — "no silent edits"). Used across modules.
 */
@Injectable()
export class AuditService {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  async log(entry: AuditEntry): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        actorId: entry.actorId ?? null,
        entityType: entry.entityType,
        entityId: entry.entityId,
        action: entry.action,
        fromState: entry.fromState ?? null,
        toState: entry.toState ?? null,
        metadata: entry.metadata ?? {},
      },
    });
  }
}
