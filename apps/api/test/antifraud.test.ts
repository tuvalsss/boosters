// Anti-fraud tests (spec §7): FMV price-bound auto-hold + review, account-hold
// gating, KYC-for-consignment, and the rate limiter (with a fake Redis).

import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient, type User } from '@boosters/db';
import { loadEnv } from '@boosters/config';
import { AuditService } from '../src/audit/audit.service.js';
import { LedgerService } from '../src/ledger/ledger.service.js';
import { MarketplaceService } from '../src/marketplace/marketplace.service.js';
import { SubmissionsService } from '../src/submissions/submissions.service.js';
import { VaultService } from '../src/vault/vault.service.js';
import { RateLimitService, type RedisLike } from '../src/ratelimit/rate-limit.service.js';
import type { CnftTransferrer } from '../src/marketplace/cnft-transferrer.js';
import type { CnftMinter, MintResult } from '../src/vault/cnft-minter.js';

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
const market = new MarketplaceService(prisma, env, noop, ledger, audit);
const minter: CnftMinter = {
  isConfigured: true,
  async mint(): Promise<MintResult> {
    return {
      assetId: `a_${randomUUID()}`,
      merkleTree: 'P9Tree',
      leafIndex: 0,
      signature: `s_${randomUUID()}`,
    };
  },
};
const vault = new VaultService(prisma, env, minter, audit);
const submissions = new SubmissionsService(prisma, vault, audit);

async function makeUser(over: Partial<User> = {}): Promise<User> {
  return prisma.user.create({
    data: {
      email: `u_${randomUUID()}@phase9.test`,
      role: 'USER',
      hold: 'NONE',
      kycStatus: 'APPROVED',
      walletAddress: `W_${randomUUID()}`,
      ...over,
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
          certNumber: `P9-${randomUUID()}`,
        },
      },
      token: {
        create: {
          cnftAssetId: `asset_${randomUUID()}`,
          merkleTree: 'P9Tree',
          leafIndex: 0,
          mintSignature: `sig_${randomUUID()}`,
          owner: { connect: { id: owner.id } },
          status: 'ACTIVE',
        },
      },
    },
  });
  if (fmv)
    await prisma.fmvSnapshot.create({
      data: {
        vaultItemId: item.id,
        physicalCardId: item.physicalCardId,
        source: 'MANUAL',
        valueUsdc: fmv,
      },
    });
  return item;
}
async function cleanup() {
  const users = await prisma.user.findMany({ where: { email: { contains: '@phase9.test' } } });
  const ids = users.map((u) => u.id);
  if (ids.length === 0) return;
  await prisma.submission.deleteMany({ where: { userId: { in: ids } } });
  await prisma.listing.deleteMany({ where: { sellerId: { in: ids } } });
  await prisma.fmvSnapshot.deleteMany({
    where: { physicalCard: { certNumber: { startsWith: 'P9-' } } },
  });
  await prisma.token.deleteMany({ where: { ownerId: { in: ids } } });
  await prisma.vaultItem.deleteMany({ where: { ownerId: { in: ids } } });
  await prisma.physicalCard.deleteMany({ where: { certNumber: { startsWith: 'P9-' } } });
  await prisma.auditLog.deleteMany({ where: { actorId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
}
beforeEach(cleanup);
afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

describe('listing anti-fraud', () => {
  it('auto-HOLDs a listing priced far from FMV, then ops can approve it', async () => {
    const seller = await makeUser();
    const item = await makeVaultedToken(seller, '100'); // FMV 100; default deviation 2500bps (25%)
    const held = await market.createListing(seller, item.id, '1000'); // 900% off
    expect(held.status).toBe('HELD');
    expect(held.heldReason).toMatch(/FMV/);

    const ops = await makeUser({ role: 'OPS' });
    const approved = await market.reviewListing(ops, held.id, true);
    expect(approved.status).toBe('ACTIVE');
  });

  it('lists normally when price is within the FMV band', async () => {
    const seller = await makeUser();
    const item = await makeVaultedToken(seller, '100');
    const listing = await market.createListing(seller, item.id, '110'); // 10% off, within 25%
    expect(listing.status).toBe('ACTIVE');
  });

  it('blocks listing while the account is on hold', async () => {
    const seller = await makeUser({ hold: 'NEW_ACCOUNT' });
    const item = await makeVaultedToken(seller);
    await expect(market.createListing(seller, item.id, '100')).rejects.toThrow(/on hold/i);
  });
});

describe('KYC for consignment', () => {
  it('blocks submission creation without approved KYC', async () => {
    const user = await makeUser({ kycStatus: 'NONE' });
    await expect(
      submissions.create(user, { category: 'POKEMON', grader: 'PSA', cardName: 'X' }),
    ).rejects.toThrow(/KYC/i);
  });
});

describe('rate limiter', () => {
  it('allows up to the limit then blocks (fixed daily window)', async () => {
    const store = new Map<string, number>();
    const fake: RedisLike = {
      async incr(k) {
        const n = (store.get(k) ?? 0) + 1;
        store.set(k, n);
        return n;
      },
      async expire() {
        return 1;
      },
    };
    const rl = new RateLimitService(fake);
    const id = 'user1';
    expect((await rl.hit('listing', id, 2)).allowed).toBe(true);
    expect((await rl.hit('listing', id, 2)).allowed).toBe(true);
    expect((await rl.hit('listing', id, 2)).allowed).toBe(false);
  });

  it('fails open when Redis throws', async () => {
    const broken: RedisLike = {
      async incr() {
        throw new Error('down');
      },
      async expire() {
        return 0;
      },
    };
    const rl = new RateLimitService(broken);
    expect((await rl.hit('listing', 'u', 1)).allowed).toBe(true);
  });
});
