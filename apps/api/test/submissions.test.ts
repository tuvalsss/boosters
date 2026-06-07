// DB-integration test for the consignment lifecycle. Real services against
// Postgres; only the external mint is a deterministic in-test minter.

import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient, type User } from '@boosters/db';
import { loadEnv } from '@boosters/config';
import { AuditService } from '../src/audit/audit.service.js';
import { VaultService } from '../src/vault/vault.service.js';
import { SubmissionsService } from '../src/submissions/submissions.service.js';
import type { CnftMinter, MintResult } from '../src/vault/cnft-minter.js';

const prisma = new PrismaClient();
const audit = new AuditService(prisma);
const env = loadEnv({
  DATABASE_URL:
    process.env.DATABASE_URL ?? 'postgresql://boosters:boosters@localhost:5432/boosters_test',
  PUBLIC_API_URL: 'http://localhost:4000',
} as NodeJS.ProcessEnv);

class TestMinter implements CnftMinter {
  isConfigured = true;
  async mint(): Promise<MintResult> {
    const id = randomUUID();
    return { assetId: `asset_${id}`, merkleTree: 'P5Tree', leafIndex: 0, signature: `sig_${id}` };
  }
}

const vault = new VaultService(prisma, env, new TestMinter(), audit);
const svc = new SubmissionsService(prisma, vault, audit);

async function makeUser(role: 'USER' | 'OPS' = 'USER'): Promise<User> {
  return prisma.user.create({
    data: {
      email: `u_${randomUUID()}@phase5.test`,
      role,
      hold: 'NONE',
      kycStatus: 'APPROVED', // consignment requires KYC (spec §7)
      walletAddress: `W_${randomUUID()}`,
    },
  });
}

const declared = { category: 'POKEMON' as const, grader: 'PSA' as const, cardName: 'Blastoise' };
const confirmed = { ...declared, certNumber: `P5-${randomUUID()}` };

async function cleanup() {
  const users = await prisma.user.findMany({ where: { email: { contains: '@phase5.test' } } });
  const ids = users.map((u) => u.id);
  if (ids.length === 0) return;
  await prisma.submission.deleteMany({ where: { userId: { in: ids } } });
  await prisma.token.deleteMany({ where: { ownerId: { in: ids } } });
  await prisma.vaultItem.deleteMany({ where: { ownerId: { in: ids } } });
  await prisma.physicalCard.deleteMany({ where: { certNumber: { startsWith: 'P5-' } } });
  await prisma.auditLog.deleteMany({ where: { actorId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
}

beforeEach(cleanup);
afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

describe('consignment lifecycle', () => {
  it('runs declare → label → ship → receive → grade → mint, minting to the submitter', async () => {
    const user = await makeUser();
    const ops = await makeUser('OPS');

    let sub = await svc.create(user, declared);
    expect(sub.status).toBe('DRAFT');

    sub = await svc.generateLabel(user, sub.id);
    expect(sub.status).toBe('LABEL_GENERATED');
    expect(sub.shippingLabelUrl).toMatch(/^ref:BST-/);

    sub = await svc.markShipped(user, sub.id, 'TRACK123');
    expect(sub.status).toBe('IN_TRANSIT');

    sub = await svc.receive(ops, sub.id, { ...confirmed, certNumber: `P5-${randomUUID()}` });
    expect(sub.status).toBe('RECEIVED');
    expect(sub.vaultItemId).toBeTruthy();
    // Vault item is owned by the submitter, not ops.
    const vi = await prisma.vaultItem.findUnique({ where: { id: sub.vaultItemId! } });
    expect(vi?.ownerId).toBe(user.id);

    sub = await svc.authenticate(ops, sub.id);
    sub = await svc.grade(ops, sub.id, '9');
    sub = await svc.addPhotos(ops, sub.id, ['https://img/front.png']);
    expect(sub.status).toBe('PHOTOGRAPHED');

    sub = await svc.mint(ops, sub.id);
    expect(sub.status).toBe('MINTED');

    // Token minted to the submitter; item VAULTED.
    const token = await prisma.token.findUnique({ where: { vaultItemId: sub.vaultItemId! } });
    expect(token?.ownerId).toBe(user.id);
    const finalItem = await prisma.vaultItem.findUnique({ where: { id: sub.vaultItemId! } });
    expect(finalItem?.state).toBe('VAULTED');

    // Timeline recorded each step.
    const events = await prisma.submissionEvent.findMany({ where: { submissionId: sub.id } });
    expect(events.length).toBeGreaterThanOrEqual(7);
  });

  it('lets a user cancel before receipt but not after', async () => {
    const user = await makeUser();
    const ops = await makeUser('OPS');
    const sub = await svc.create(user, declared);
    const cancelled = await svc.cancel(user, sub.id);
    expect(cancelled.status).toBe('CANCELLED');

    const sub2 = await svc.create(user, declared);
    await svc.generateLabel(user, sub2.id);
    await svc.markShipped(user, sub2.id, 'T');
    await svc.receive(ops, sub2.id, { ...confirmed, certNumber: `P5-${randomUUID()}` });
    await expect(svc.cancel(user, sub2.id)).rejects.toThrow(/processing/i);
  });

  it('cannot mint a submission that was never received', async () => {
    const user = await makeUser();
    const ops = await makeUser('OPS');
    const sub = await svc.create(user, declared);
    await expect(svc.mint(ops, sub.id)).rejects.toThrow(/not been received/i);
  });
});
