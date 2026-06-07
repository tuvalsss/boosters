// DB-integration tests for the worker maintenance jobs (no Redis needed).

import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient, type User } from '@boosters/db';
import { expireBuybackQuotes, expireStaleOnramps } from '../src/jobs/maintenance.js';

const prisma = new PrismaClient();

async function makeUser(): Promise<User> {
  return prisma.user.create({
    data: { email: `u_${randomUUID()}@worker.test`, role: 'USER', hold: 'NONE' },
  });
}

async function makeVaultItem(owner: User): Promise<string> {
  const item = await prisma.vaultItem.create({
    data: {
      state: 'VAULTED',
      owner: { connect: { id: owner.id } },
      physicalCard: {
        create: {
          category: 'POKEMON',
          grader: 'PSA',
          cardName: 'C',
          certNumber: `WK-${randomUUID()}`,
        },
      },
    },
  });
  return item.id;
}

async function cleanup() {
  const users = await prisma.user.findMany({ where: { email: { contains: '@worker.test' } } });
  const ids = users.map((u) => u.id);
  if (ids.length === 0) return;
  await prisma.buybackQuote.deleteMany({ where: { userId: { in: ids } } });
  await prisma.order.deleteMany({ where: { buyerId: { in: ids } } });
  await prisma.vaultItem.deleteMany({ where: { ownerId: { in: ids } } });
  await prisma.physicalCard.deleteMany({ where: { certNumber: { startsWith: 'WK-' } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
}

beforeEach(cleanup);
afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

describe('worker maintenance', () => {
  it('expires only past-due QUOTED buyback quotes', async () => {
    const user = await makeUser();
    const vaultItemId = await makeVaultItem(user);
    const past = await prisma.buybackQuote.create({
      data: {
        userId: user.id,
        vaultItemId,
        percentBps: 8750,
        quoteUsdc: '10',
        status: 'QUOTED',
        expiresAt: new Date(Date.now() - 1000),
      },
    });
    const future = await prisma.buybackQuote.create({
      data: {
        userId: user.id,
        vaultItemId,
        percentBps: 8750,
        quoteUsdc: '10',
        status: 'QUOTED',
        expiresAt: new Date(Date.now() + 60_000),
      },
    });

    const count = await expireBuybackQuotes(prisma);
    expect(count).toBe(1);
    expect((await prisma.buybackQuote.findUnique({ where: { id: past.id } }))?.status).toBe(
      'EXPIRED',
    );
    expect((await prisma.buybackQuote.findUnique({ where: { id: future.id } }))?.status).toBe(
      'QUOTED',
    );
  });

  it('fails abandoned pending on-ramp deposits past the cutoff', async () => {
    const user = await makeUser();
    const old = await prisma.order.create({
      data: {
        type: 'DEPOSIT',
        status: 'PENDING',
        buyerId: user.id,
        amountUsdc: '100',
        idempotencyKey: `o_${randomUUID()}`,
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      },
    });
    const fresh = await prisma.order.create({
      data: {
        type: 'DEPOSIT',
        status: 'PENDING',
        buyerId: user.id,
        amountUsdc: '100',
        idempotencyKey: `o_${randomUUID()}`,
      },
    });

    const count = await expireStaleOnramps(prisma, 60 * 60 * 1000);
    expect(count).toBe(1);
    expect((await prisma.order.findUnique({ where: { id: old.id } }))?.status).toBe('FAILED');
    expect((await prisma.order.findUnique({ where: { id: fresh.id } }))?.status).toBe('PENDING');
  });
});
