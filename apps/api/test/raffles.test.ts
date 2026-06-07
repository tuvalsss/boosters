// DB-integration tests for raffles: reserve, ticket sales to escrow, provably
// fair draw with proceeds + fee, and full refunds on cancel.

import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient, type User } from '@boosters/db';
import { loadEnv } from '@boosters/config';
import { AuditService } from '../src/audit/audit.service.js';
import { LedgerService } from '../src/ledger/ledger.service.js';
import { MarketplaceService } from '../src/marketplace/marketplace.service.js';
import { RafflesService } from '../src/raffles/raffles.service.js';
import type { CnftTransferrer } from '../src/marketplace/cnft-transferrer.js';

const prisma = new PrismaClient();
const audit = new AuditService(prisma);
const ledger = new LedgerService(prisma);
const env = loadEnv({
  DATABASE_URL:
    process.env.DATABASE_URL ?? 'postgresql://boosters:boosters@localhost:5432/boosters_test',
} as NodeJS.ProcessEnv);
const noop: CnftTransferrer = {
  isConfigured: false,
  async transfer() {
    return null;
  },
};
const raffles = new RafflesService(prisma, env, noop, ledger, audit);
const market = new MarketplaceService(prisma, env, noop, ledger, audit);

async function makeUser(role: 'USER' | 'OPS' = 'USER'): Promise<User> {
  return prisma.user.create({
    data: {
      email: `u_${randomUUID()}@phase8r.test`,
      role,
      hold: 'NONE',
      walletAddress: `W_${randomUUID()}`,
    },
  });
}
async function makeVaultedToken(owner: User) {
  return prisma.vaultItem.create({
    data: {
      state: 'VAULTED',
      owner: { connect: { id: owner.id } },
      physicalCard: {
        create: {
          category: 'POKEMON',
          grader: 'PSA',
          cardName: 'Grail',
          certNumber: `P8R-${randomUUID()}`,
        },
      },
      token: {
        create: {
          cnftAssetId: `asset_${randomUUID()}`,
          merkleTree: 'P8RTree',
          leafIndex: 0,
          mintSignature: `sig_${randomUUID()}`,
          owner: { connect: { id: owner.id } },
          status: 'ACTIVE',
        },
      },
    },
    include: { token: true },
  });
}
async function cleanup() {
  const users = await prisma.user.findMany({ where: { email: { contains: '@phase8r.test' } } });
  const ids = users.map((u) => u.id);
  if (ids.length === 0) return;
  await prisma.raffleTicket.deleteMany({ where: { userId: { in: ids } } });
  await prisma.raffle.deleteMany({ where: { vaultItem: { ownerId: { in: ids } } } });
  const orders = await prisma.order.findMany({
    where: {
      OR: [
        { buyerId: { in: ids } },
        { sellerId: { in: ids } },
        { type: { in: ['RAFFLE_TICKET', 'REFUND', 'DEPOSIT'] } },
      ],
    },
    select: { id: true },
  });
  const orderIds = orders.map((o) => o.id);
  await prisma.ledgerEntry.deleteMany({ where: { orderId: { in: orderIds } } });
  await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
  await prisma.token.deleteMany({ where: { ownerId: { in: ids } } });
  await prisma.vaultItem.deleteMany({ where: { ownerId: { in: ids } } });
  await prisma.physicalCard.deleteMany({ where: { certNumber: { startsWith: 'P8R-' } } });
  await prisma.auditLog.deleteMany({ where: { actorId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
}
beforeEach(cleanup);
afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

describe('raffles', () => {
  it('reserves the item, sells tickets to escrow, and draws a winner with proceeds', async () => {
    const owner = await makeUser('OPS');
    const player = await makeUser();
    const item = await makeVaultedToken(owner);
    const raffle = await raffles.create(owner, item.id, 2, '10');
    expect((await prisma.vaultItem.findUnique({ where: { id: item.id } }))?.state).toBe('RESERVED');

    await market.creditBalance(owner, player.id, '20');
    const res = await raffles.buyTickets(player, raffle.id, 2);
    expect(res.ticketsSold).toBe(2);
    expect((await prisma.raffle.findUnique({ where: { id: raffle.id } }))?.status).toBe('SOLD_OUT');

    const drawn = await raffles.draw(owner, raffle.id);
    expect(drawn.status).toBe('SETTLED');
    expect(drawn.winnerId).toBe(player.id);

    // Winner owns the card (back to VAULTED); seller paid 20 − 2% = 19.6.
    const token = await prisma.token.findUnique({ where: { vaultItemId: item.id } });
    expect(token?.ownerId).toBe(player.id);
    expect((await prisma.vaultItem.findUnique({ where: { id: item.id } }))?.state).toBe('VAULTED');
    expect((await ledger.balanceOf(owner.id)).toString()).toBe('19.6');
  });

  it('refunds all buyers on cancel and releases the item', async () => {
    const owner = await makeUser('OPS');
    const a = await makeUser();
    const b = await makeUser();
    const item = await makeVaultedToken(owner);
    const raffle = await raffles.create(owner, item.id, 3, '10');
    await market.creditBalance(owner, a.id, '10');
    await market.creditBalance(owner, b.id, '10');
    await raffles.buyTickets(a, raffle.id, 1);
    await raffles.buyTickets(b, raffle.id, 1);

    await raffles.cancel(owner, raffle.id);
    expect((await ledger.balanceOf(a.id)).toString()).toBe('10');
    expect((await ledger.balanceOf(b.id)).toString()).toBe('10');
    expect((await prisma.vaultItem.findUnique({ where: { id: item.id } }))?.state).toBe('VAULTED');
    expect((await prisma.raffle.findUnique({ where: { id: raffle.id } }))?.status).toBe(
      'CANCELLED',
    );
  });

  it('cannot buy more tickets than remain', async () => {
    const owner = await makeUser('OPS');
    const player = await makeUser();
    const item = await makeVaultedToken(owner);
    const raffle = await raffles.create(owner, item.id, 2, '10');
    await market.creditBalance(owner, player.id, '100');
    await expect(raffles.buyTickets(player, raffle.id, 3)).rejects.toThrow(/remain/i);
  });
});
