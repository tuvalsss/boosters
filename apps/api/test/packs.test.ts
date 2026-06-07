// DB-integration test for provably-fair pack opening: commit charges the user,
// reveal draws a winner, moves ownership, and is reproducible + idempotent.

import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient, type User } from '@boosters/db';
import { AuditService } from '../src/audit/audit.service.js';
import { LedgerService } from '../src/ledger/ledger.service.js';
import { MarketplaceService } from '../src/marketplace/marketplace.service.js';
import { PacksService } from '../src/packs/packs.service.js';
import { verify } from '../src/packs/pack-fairness.js';
import { loadEnv } from '@boosters/config';
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
const packs = new PacksService(prisma, noop, ledger, audit);
const market = new MarketplaceService(prisma, env, noop, ledger, audit);

async function makeUser(role: 'USER' | 'OPS' = 'USER'): Promise<User> {
  return prisma.user.create({
    data: {
      email: `u_${randomUUID()}@phase6.test`,
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
          cardName: 'Card',
          certNumber: `P6-${randomUUID()}`,
        },
      },
      token: {
        create: {
          cnftAssetId: `asset_${randomUUID()}`,
          merkleTree: 'P6Tree',
          leafIndex: 0,
          mintSignature: `sig_${randomUUID()}`,
          owner: { connect: { id: owner.id } },
          status: 'ACTIVE',
        },
      },
    },
  });
}

async function cleanup() {
  const users = await prisma.user.findMany({ where: { email: { contains: '@phase6.test' } } });
  const ids = users.map((u) => u.id);
  if (ids.length === 0) return;
  await prisma.packOpening.deleteMany({ where: { userId: { in: ids } } });
  await prisma.packPoolItem.deleteMany({ where: { vaultItem: { ownerId: { in: ids } } } });
  await prisma.pack.deleteMany({ where: { name: { startsWith: 'P6 ' } } });
  await prisma.ledgerEntry.deleteMany({
    where: { OR: [{ userId: { in: ids } }, { order: { buyerId: { in: ids } } }] },
  });
  await prisma.order.deleteMany({ where: { buyerId: { in: ids } } });
  await prisma.token.deleteMany({ where: { ownerId: { in: ids } } });
  await prisma.vaultItem.deleteMany({ where: { ownerId: { in: ids } } });
  await prisma.physicalCard.deleteMany({ where: { certNumber: { startsWith: 'P6-' } } });
  await prisma.auditLog.deleteMany({ where: { actorId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
}

beforeEach(cleanup);
afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

describe('pack opening — provably fair', () => {
  it('commits (charges), reveals (draws + transfers), and is reproducible', async () => {
    const ops = await makeUser('OPS');
    const user = await makeUser();

    // Platform pool of 3 vaulted cards.
    const pool = await Promise.all([
      makeVaultedToken(ops),
      makeVaultedToken(ops),
      makeVaultedToken(ops),
    ]);
    const pack = await packs.createPack(ops, 'P6 Booster', '10');
    for (const item of pool) await packs.addPoolItem(ops, pack.id, item.id);
    await packs.setStatus(ops, pack.id, 'ACTIVE');

    await market.creditBalance(ops, user.id, '10');

    // Commit: charged, server seed NOT leaked.
    const committed = await packs.commit(user, pack.id, 'my-client-seed');
    expect(committed.status).toBe('COMMITTED');
    expect(committed.serverSeed).toBeNull();
    expect(committed.serverSeedHash).toHaveLength(64);
    expect((await ledger.balanceOf(user.id)).toString()).toBe('0'); // paid 10

    // Reveal: draws a winner, settles, reveals the seed.
    const settled = await packs.reveal(user, committed.id);
    expect(settled.status).toBe('SETTLED');
    expect(settled.resultVaultItemId).toBeTruthy();
    expect(settled.serverSeed).toBeTruthy();

    // Won card now owned by the user; pool item consumed.
    const wonToken = await prisma.token.findUnique({
      where: { vaultItemId: settled.resultVaultItemId! },
    });
    expect(wonToken?.ownerId).toBe(user.id);
    const consumed = await prisma.packPoolItem.count({
      where: { packId: pack.id, consumed: true },
    });
    expect(consumed).toBe(1);

    // Anyone can reproduce the result from the public opening record.
    const pub = await packs.getOpening(committed.id);
    const proof = pub.proof as {
      candidates: { poolItemId: string; vaultItemId: string; weight: number }[];
    };
    const check = verify({
      serverSeed: pub.serverSeed!,
      serverSeedHash: pub.serverSeedHash,
      clientSeed: pub.clientSeed,
      nonce: pub.nonce,
      candidates: proof.candidates,
      expectedVaultItemId: pub.resultVaultItemId!,
    });
    expect(check.ok).toBe(true);
  });

  it('reveal is idempotent and the server seed stays hidden until reveal', async () => {
    const ops = await makeUser('OPS');
    const user = await makeUser();
    const pool = await Promise.all([makeVaultedToken(ops), makeVaultedToken(ops)]);
    const pack = await packs.createPack(ops, 'P6 Idem', '5');
    for (const item of pool) await packs.addPoolItem(ops, pack.id, item.id);
    await packs.setStatus(ops, pack.id, 'ACTIVE');
    await market.creditBalance(ops, user.id, '5');

    const committed = await packs.commit(user, pack.id);
    // Public view before reveal must not expose the server seed.
    const before = await packs.getOpening(committed.id);
    expect(before.serverSeed).toBeNull();

    const first = await packs.reveal(user, committed.id);
    const again = await packs.reveal(user, committed.id);
    expect(again.resultVaultItemId).toBe(first.resultVaultItemId);
    const consumed = await prisma.packPoolItem.count({
      where: { packId: pack.id, consumed: true },
    });
    expect(consumed).toBe(1); // not double-consumed
  });

  it('rejects opening without enough balance', async () => {
    const ops = await makeUser('OPS');
    const user = await makeUser();
    const item = await makeVaultedToken(ops);
    const pack = await packs.createPack(ops, 'P6 Broke', '50');
    await packs.addPoolItem(ops, pack.id, item.id);
    await packs.setStatus(ops, pack.id, 'ACTIVE');
    await expect(packs.commit(user, pack.id)).rejects.toThrow(/insufficient/i);
  });
});
