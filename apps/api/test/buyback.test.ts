// DB-integration tests for buyback: FMV quote, treasury float-floor HARD guard,
// payout, token returns to treasury, and the pause flag.

import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient, type User } from '@boosters/db';
import { loadEnv } from '@boosters/config';
import { AuditService } from '../src/audit/audit.service.js';
import { LedgerService } from '../src/ledger/ledger.service.js';
import { SettingsService } from '../src/settings/settings.service.js';
import { BuybackService } from '../src/buyback/buyback.service.js';

const prisma = new PrismaClient();
const audit = new AuditService(prisma);
const ledger = new LedgerService(prisma);
const settings = new SettingsService(prisma);
// Floor = 1000 (default), buyback % = 8750 (default).
const env = loadEnv({
  DATABASE_URL:
    process.env.DATABASE_URL ?? 'postgresql://boosters:boosters@localhost:5432/boosters_test',
} as NodeJS.ProcessEnv);
const svc = new BuybackService(prisma, env, ledger, settings, audit);

async function makeUser(): Promise<User> {
  return prisma.user.create({
    data: {
      email: `u_${randomUUID()}@phase7.test`,
      role: 'USER',
      hold: 'NONE',
      walletAddress: `W_${randomUUID()}`,
    },
  });
}

async function makeVaultedToken(owner: User, fmv?: string) {
  const item = await prisma.vaultItem.create({
    data: {
      state: 'VAULTED',
      owner: { connect: { id: owner.id } },
      physicalCard: {
        create: {
          category: 'POKEMON',
          grader: 'PSA',
          cardName: 'Card',
          certNumber: `P7-${randomUUID()}`,
        },
      },
      token: {
        create: {
          cnftAssetId: `asset_${randomUUID()}`,
          merkleTree: 'P7Tree',
          leafIndex: 0,
          mintSignature: `sig_${randomUUID()}`,
          owner: { connect: { id: owner.id } },
          status: 'ACTIVE',
        },
      },
    },
    include: { token: true },
  });
  if (fmv) {
    await prisma.fmvSnapshot.create({
      data: {
        vaultItemId: item.id,
        physicalCardId: item.physicalCardId,
        source: 'MANUAL',
        valueUsdc: fmv,
      },
    });
  }
  return item;
}

async function cleanup() {
  const all = await prisma.user.findMany({
    where: { OR: [{ email: { contains: '@phase7.test' } }, { email: 'treasury@boosters.local' }] },
  });
  const ids = all.map((u) => u.id);
  if (ids.length === 0) return;
  await prisma.buybackQuote.deleteMany({ where: { userId: { in: ids } } });
  const orders = await prisma.order.findMany({
    where: { OR: [{ buyerId: { in: ids } }, { sellerId: { in: ids } }, { type: 'DEPOSIT' }] },
    select: { id: true },
  });
  const orderIds = orders.map((o) => o.id);
  await prisma.ledgerEntry.deleteMany({ where: { orderId: { in: orderIds } } });
  await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
  await prisma.fmvSnapshot.deleteMany({
    where: { physicalCard: { certNumber: { startsWith: 'P7-' } } },
  });
  await prisma.token.deleteMany({ where: { ownerId: { in: ids } } });
  await prisma.vaultItem.deleteMany({ where: { ownerId: { in: ids } } });
  await prisma.physicalCard.deleteMany({ where: { certNumber: { startsWith: 'P7-' } } });
  await prisma.auditLog.deleteMany({ where: { actorId: { in: ids } } });
}

beforeEach(async () => {
  await cleanup();
  await settings.setBool('buyback.paused', false);
});
afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

describe('buyback', () => {
  it('quotes at the configured % of FMV', async () => {
    const user = await makeUser();
    const item = await makeVaultedToken(user, '1000'); // FMV 1000
    const quote = await svc.quote(user, item.id);
    // 87.5% of 1000 = 875
    expect(quote.quoteUsdc.toString()).toBe('875');
    expect(quote.status).toBe('QUOTED');
  });

  it('pays out and returns the token to the treasury when above the float floor', async () => {
    const user = await makeUser();
    const item = await makeVaultedToken(user, '1000');
    // Fund treasury well above floor (1000) + payout (875).
    await svc.creditTreasury(user, '5000');

    const quote = await svc.quote(user, item.id);
    const paid = await svc.accept(user, quote.id);
    expect(paid.status).toBe('PAID');
    expect((await ledger.balanceOf(user.id)).toString()).toBe('875');

    // Token + item now owned by the treasury user.
    const treasury = await prisma.user.findUnique({ where: { email: 'treasury@boosters.local' } });
    const token = await prisma.token.findUnique({ where: { vaultItemId: item.id } });
    expect(token?.ownerId).toBe(treasury?.id);
  });

  it('HARD GUARD: refuses to pay below the treasury float floor', async () => {
    const user = await makeUser();
    const item = await makeVaultedToken(user, '1000'); // quote 875
    // Treasury just above floor — paying 875 would breach 1000 floor.
    await svc.creditTreasury(user, '1200'); // balance 1200; 1200-875=325 < 1000
    const quote = await svc.quote(user, item.id);
    await expect(svc.accept(user, quote.id)).rejects.toThrow(/float floor/i);
    // User not paid.
    expect((await ledger.balanceOf(user.id)).toString()).toBe('0');
  });

  it('respects the pause flag', async () => {
    const user = await makeUser();
    const item = await makeVaultedToken(user, '1000');
    await svc.setPaused(user, true);
    await expect(svc.quote(user, item.id)).rejects.toThrow(/paused/i);
    await svc.setPaused(user, false);
  });

  it('requires an FMV to quote', async () => {
    const user = await makeUser();
    const item = await makeVaultedToken(user); // no FMV
    await expect(svc.quote(user, item.id)).rejects.toThrow(/FMV/i);
  });
});
