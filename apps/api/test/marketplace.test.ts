// DB-integration tests for the marketplace money path. The double-entry ledger,
// fee split, ownership move and idempotency are the real implementation, run
// against Postgres (the deferred balance trigger validates every posting). Only
// the external on-chain transfer is stood in by a no-op transferrer.

import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { Prisma, PrismaClient, type User } from '@boosters/db';
import { loadEnv } from '@boosters/config';
import { AuditService } from '../src/audit/audit.service.js';
import { LedgerService } from '../src/ledger/ledger.service.js';
import { MarketplaceService } from '../src/marketplace/marketplace.service.js';
import type { CnftTransferrer } from '../src/marketplace/cnft-transferrer.js';

const prisma = new PrismaClient();
const audit = new AuditService(prisma);
const ledger = new LedgerService(prisma);
const env = loadEnv({
  DATABASE_URL:
    process.env.DATABASE_URL ?? 'postgresql://boosters:boosters@localhost:5432/boosters_test',
} as NodeJS.ProcessEnv);

const noopTransferrer: CnftTransferrer = {
  isConfigured: false,
  async transfer() {
    return null;
  },
};
const svc = new MarketplaceService(prisma, env, noopTransferrer, ledger, audit);

async function makeUser(role: 'USER' | 'OPS' = 'USER'): Promise<User> {
  return prisma.user.create({
    data: {
      email: `u_${randomUUID()}@phase4.test`,
      role,
      hold: 'NONE',
      walletAddress: `W_${randomUUID()}`,
    },
  });
}

/** Create a VAULTED item with an ACTIVE token owned by `owner` (Phase-3 result). */
async function makeVaultedToken(owner: User) {
  const item = await prisma.vaultItem.create({
    data: {
      state: 'VAULTED',
      owner: { connect: { id: owner.id } },
      physicalCard: {
        create: {
          category: 'POKEMON',
          grader: 'PSA',
          cardName: 'Pikachu',
          certNumber: `P4-${randomUUID()}`,
        },
      },
      token: {
        create: {
          cnftAssetId: `asset_${randomUUID()}`,
          merkleTree: 'P4Tree',
          leafIndex: 0,
          mintSignature: `sig_${randomUUID()}`,
          owner: { connect: { id: owner.id } },
          status: 'ACTIVE',
        },
      },
    },
    include: { token: true },
  });
  return item;
}

async function cleanup() {
  const users = await prisma.user.findMany({ where: { email: { contains: '@phase4.test' } } });
  const ids = users.map((u) => u.id);
  if (ids.length === 0) return;
  await prisma.ledgerEntry.deleteMany({
    where: {
      OR: [
        { userId: { in: ids } },
        { order: { OR: [{ buyerId: { in: ids } }, { sellerId: { in: ids } }] } },
      ],
    },
  });
  await prisma.order.deleteMany({
    where: { OR: [{ buyerId: { in: ids } }, { sellerId: { in: ids } }] },
  });
  await prisma.listing.deleteMany({ where: { sellerId: { in: ids } } });
  await prisma.token.deleteMany({ where: { ownerId: { in: ids } } });
  await prisma.vaultItem.deleteMany({ where: { ownerId: { in: ids } } });
  await prisma.physicalCard.deleteMany({ where: { certNumber: { startsWith: 'P4-' } } });
  await prisma.auditLog.deleteMany({ where: { actorId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
}

beforeEach(cleanup);
afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

describe('listings — custody gate', () => {
  it('cannot list an item that is not VAULTED', async () => {
    const seller = await makeUser();
    const item = await prisma.vaultItem.create({
      data: {
        state: 'GRADED',
        owner: { connect: { id: seller.id } },
        physicalCard: {
          create: {
            category: 'POKEMON',
            grader: 'PSA',
            cardName: 'X',
            certNumber: `P4-${randomUUID()}`,
          },
        },
      },
    });
    await expect(svc.createListing(seller, item.id, '100')).rejects.toThrow(/vaulted/i);
  });

  it('rejects a second active listing for the same item', async () => {
    const seller = await makeUser();
    const item = await makeVaultedToken(seller);
    await svc.createListing(seller, item.id, '100');
    await expect(svc.createListing(seller, item.id, '120')).rejects.toThrow(
      /already has an active/i,
    );
  });
});

describe('buy — money path', () => {
  it('splits the 2% fee, moves ownership and closes the listing', async () => {
    const admin = await makeUser('OPS');
    const seller = await makeUser();
    const buyer = await makeUser();
    const item = await makeVaultedToken(seller);
    const listing = await svc.createListing(seller, item.id, '100');

    await svc.creditBalance(admin, buyer.id, '100');
    const order = await svc.buy(buyer, listing.id, `buy_${randomUUID()}`);

    expect(order.status).toBe('COMPLETED');
    expect(order.feeUsdc.toString()).toBe('2'); // 2% of 100

    // Balances: buyer −100, seller +98, fee revenue +2.
    expect((await ledger.balanceOf(buyer.id)).toString()).toBe('0');
    expect((await ledger.balanceOf(seller.id)).toString()).toBe('98');

    // Ownership moved to buyer; listing SOLD.
    const token = await prisma.token.findUnique({ where: { id: item.token!.id } });
    expect(token?.ownerId).toBe(buyer.id);
    const vi = await prisma.vaultItem.findUnique({ where: { id: item.id } });
    expect(vi?.ownerId).toBe(buyer.id);
    const closed = await prisma.listing.findUnique({ where: { id: listing.id } });
    expect(closed?.status).toBe('SOLD');

    // Fee revenue captured.
    const fee = await prisma.ledgerEntry.aggregate({
      where: { orderId: order.id, accountType: 'FEE_REVENUE' },
      _sum: { amountUsdc: true },
    });
    expect((fee._sum.amountUsdc ?? new Prisma.Decimal(0)).toString()).toBe('2');
  });

  it('rejects a buy with insufficient balance', async () => {
    const seller = await makeUser();
    const buyer = await makeUser();
    const item = await makeVaultedToken(seller);
    const listing = await svc.createListing(seller, item.id, '100');
    await expect(svc.buy(buyer, listing.id, `buy_${randomUUID()}`)).rejects.toThrow(
      /insufficient/i,
    );
  });

  it('forbids buying your own listing', async () => {
    const seller = await makeUser('OPS');
    const item = await makeVaultedToken(seller);
    const listing = await svc.createListing(seller, item.id, '50');
    await svc.creditBalance(seller, seller.id, '50');
    await expect(svc.buy(seller, listing.id, `buy_${randomUUID()}`)).rejects.toThrow(/your own/i);
  });

  it('is idempotent on the supplied key', async () => {
    const admin = await makeUser('OPS');
    const seller = await makeUser();
    const buyer = await makeUser();
    const item = await makeVaultedToken(seller);
    const listing = await svc.createListing(seller, item.id, '100');
    await svc.creditBalance(admin, buyer.id, '100');

    const key = `buy_${randomUUID()}`;
    const a = await svc.buy(buyer, listing.id, key);
    const b = await svc.buy(buyer, listing.id, key); // replay
    expect(b.id).toBe(a.id);
    // Buyer was charged exactly once.
    expect((await ledger.balanceOf(buyer.id)).toString()).toBe('0');
  });
});
