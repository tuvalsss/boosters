// DB-integration tests for redeem/claim: burn → release → shipping record, and
// the custody gate (a burned token can never be re-listed).

import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient, type User } from '@boosters/db';
import { loadEnv } from '@boosters/config';
import { AuditService } from '../src/audit/audit.service.js';
import { LedgerService } from '../src/ledger/ledger.service.js';
import { MarketplaceService } from '../src/marketplace/marketplace.service.js';
import { RedeemService } from '../src/redeem/redeem.service.js';
import type { CnftBurner } from '../src/redeem/cnft-burner.js';
import type { CnftTransferrer } from '../src/marketplace/cnft-transferrer.js';

const prisma = new PrismaClient();
const audit = new AuditService(prisma);
const ledger = new LedgerService(prisma);
const env = loadEnv({
  DATABASE_URL:
    process.env.DATABASE_URL ?? 'postgresql://boosters:boosters@localhost:5432/boosters_test',
} as NodeJS.ProcessEnv);
const noopBurner: CnftBurner = {
  isConfigured: false,
  async burn() {
    return null;
  },
};
const noopTransfer: CnftTransferrer = {
  isConfigured: false,
  async transfer() {
    return null;
  },
};
const redeem = new RedeemService(prisma, noopBurner, audit);
const market = new MarketplaceService(prisma, env, noopTransfer, ledger, audit);

async function makeUser(): Promise<User> {
  return prisma.user.create({
    data: {
      email: `u_${randomUUID()}@phase8d.test`,
      role: 'USER',
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
          cardName: 'Card',
          certNumber: `P8D-${randomUUID()}`,
        },
      },
      token: {
        create: {
          cnftAssetId: `asset_${randomUUID()}`,
          merkleTree: 'P8DTree',
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
  const users = await prisma.user.findMany({ where: { email: { contains: '@phase8d.test' } } });
  const ids = users.map((u) => u.id);
  if (ids.length === 0) return;
  await prisma.redemption.deleteMany({ where: { userId: { in: ids } } });
  await prisma.listing.deleteMany({ where: { sellerId: { in: ids } } });
  await prisma.token.deleteMany({ where: { ownerId: { in: ids } } });
  await prisma.vaultItem.deleteMany({ where: { ownerId: { in: ids } } });
  await prisma.physicalCard.deleteMany({ where: { certNumber: { startsWith: 'P8D-' } } });
  await prisma.auditLog.deleteMany({ where: { actorId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
}
beforeEach(cleanup);
afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

describe('redeem / claim', () => {
  it('burns the token, releases the item, and opens a shipping record', async () => {
    const user = await makeUser();
    const item = await makeVaultedToken(user);
    const redemption = await redeem.redeem(user, item.id, { line1: '1 Main St', country: 'US' });

    expect(redemption.status).toBe('REQUESTED');
    const token = await prisma.token.findUnique({ where: { vaultItemId: item.id } });
    expect(token?.status).toBe('BURNED');
    expect((await prisma.vaultItem.findUnique({ where: { id: item.id } }))?.state).toBe('RELEASED');
  });

  it('custody gate: a redeemed (burned) token can never be re-listed', async () => {
    const user = await makeUser();
    const item = await makeVaultedToken(user);
    await redeem.redeem(user, item.id, { line1: 'x' });
    await expect(market.createListing(user, item.id, '100')).rejects.toThrow(/vaulted, active/i);
  });

  it('cannot redeem while an active listing exists', async () => {
    const user = await makeUser();
    const item = await makeVaultedToken(user);
    await market.createListing(user, item.id, '100');
    await expect(redeem.redeem(user, item.id, { line1: 'x' })).rejects.toThrow(/active listing/i);
  });

  it('ops can advance the redemption to SHIPPED with tracking', async () => {
    const user = await makeUser();
    const item = await makeVaultedToken(user);
    const redemption = await redeem.redeem(user, item.id, { line1: 'x' });
    const shipped = await redeem.setStatus(user, redemption.id, 'SHIPPED', 'TRK999');
    expect(shipped.status).toBe('SHIPPED');
    expect(shipped.trackingNumber).toBe('TRK999');
  });
});
