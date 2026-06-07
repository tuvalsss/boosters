// DB-integration tests for the vault state machine and the custody gate.
// The state-machine + gate logic under test is the real implementation; only
// the external on-chain mint is replaced by a deterministic in-test minter so
// the gate can be exercised without a funded devnet wallet.

import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient, type User } from '@boosters/db';
import { loadEnv } from '@boosters/config';
import { AuditService } from '../src/audit/audit.service.js';
import { VaultService } from '../src/vault/vault.service.js';
import type { CnftMinter, MintParams, MintResult } from '../src/vault/cnft-minter.js';

const prisma = new PrismaClient();
const audit = new AuditService(prisma);
const env = loadEnv({
  DATABASE_URL:
    process.env.DATABASE_URL ?? 'postgresql://boosters:boosters@localhost:5432/boosters_test',
  PUBLIC_API_URL: 'http://localhost:4000',
} as NodeJS.ProcessEnv);

class TestMinter implements CnftMinter {
  isConfigured = true;
  calls = 0;
  async mint(_params: MintParams): Promise<MintResult> {
    this.calls += 1;
    const id = randomUUID();
    return {
      assetId: `asset_${id}`,
      merkleTree: 'TreeXYZ',
      leafIndex: this.calls,
      signature: `sig_${id}`,
    };
  }
}

async function makeOwner(withWallet = true): Promise<User> {
  return prisma.user.create({
    data: {
      email: `owner_${randomUUID()}@phase3.test`,
      role: 'OPS',
      walletAddress: withWallet ? `Wallet_${randomUUID()}` : null,
    },
  });
}

async function cleanup() {
  await prisma.auditLog.deleteMany({ where: { entityType: 'VaultItem' } });
  await prisma.token.deleteMany({ where: { merkleTree: 'TreeXYZ' } });
  await prisma.vaultItem.deleteMany({ where: { owner: { email: { contains: '@phase3.test' } } } });
  await prisma.physicalCard.deleteMany({ where: { certNumber: { startsWith: 'P3-' } } });
  await prisma.user.deleteMany({ where: { email: { contains: '@phase3.test' } } });
}

function service(minter: CnftMinter) {
  return new VaultService(prisma, env, minter, audit);
}

const intakeDto = (n: string) => ({
  category: 'POKEMON' as const,
  grader: 'PSA' as const,
  cardName: 'Charizard',
  certNumber: `P3-${n}`,
});

beforeEach(cleanup);
afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

describe('vault intake + state machine', () => {
  it('creates a card + vault item in INTAKE', async () => {
    const owner = await makeOwner();
    const svc = service(new TestMinter());
    const item = await svc.createIntake(owner, intakeDto(randomUUID()));
    expect(item.state).toBe('INTAKE');
    const full = await svc.findItem(item.id);
    expect(full.physicalCard.cardName).toBe('Charizard');
  });

  it('rejects an illegal transition (INTAKE → VAULTED)', async () => {
    const owner = await makeOwner();
    const svc = service(new TestMinter());
    const item = await svc.createIntake(owner, intakeDto(randomUUID()));
    await expect(svc.vault(owner, item.id)).rejects.toThrow(/Illegal vault transition|GRADED/);
  });
});

describe('custody gate — mint only at GRADED → VAULTED', () => {
  it('mints exactly one token and vaults on the happy path', async () => {
    const owner = await makeOwner();
    const minter = new TestMinter();
    const svc = service(minter);

    const item = await svc.createIntake(owner, intakeDto(randomUUID()));
    await svc.startAuthentication(owner, item.id);
    await svc.setGrade(owner, item.id, '10');
    const vaulted = await svc.vault(owner, item.id);

    expect(vaulted.state).toBe('VAULTED');
    expect(minter.calls).toBe(1);
    const token = await prisma.token.findUnique({ where: { vaultItemId: item.id } });
    expect(token?.status).toBe('ACTIVE');
    expect(token?.ownerId).toBe(owner.id);
  });

  it('is idempotent: a second vault() does not double-mint', async () => {
    const owner = await makeOwner();
    const minter = new TestMinter();
    const svc = service(minter);
    const item = await svc.createIntake(owner, intakeDto(randomUUID()));
    await svc.startAuthentication(owner, item.id);
    await svc.setGrade(owner, item.id, '10');
    await svc.vault(owner, item.id);
    await svc.vault(owner, item.id); // again

    expect(minter.calls).toBe(1);
    const count = await prisma.token.count({ where: { vaultItemId: item.id } });
    expect(count).toBe(1);
  });

  it('refuses to mint without a destination wallet', async () => {
    const owner = await makeOwner(false);
    const svc = service(new TestMinter());
    const item = await svc.createIntake(owner, intakeDto(randomUUID()));
    await svc.startAuthentication(owner, item.id);
    await svc.setGrade(owner, item.id, '10');
    await expect(svc.vault(owner, item.id)).rejects.toThrow(/wallet/i);
  });

  it('refuses to mint when the minter is not configured', async () => {
    const owner = await makeOwner();
    const minter = new TestMinter();
    minter.isConfigured = false;
    const svc = service(minter);
    const item = await svc.createIntake(owner, intakeDto(randomUUID()));
    await svc.startAuthentication(owner, item.id);
    await svc.setGrade(owner, item.id, '10');
    await expect(svc.vault(owner, item.id)).rejects.toThrow(/not configured/i);
    expect(minter.calls).toBe(0);
  });
});
