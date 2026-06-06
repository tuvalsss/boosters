// DB-integration tests for the real auth/RBAC/KYC paths. Instantiates the
// actual Nest providers (plain classes) against the test Postgres. The only
// test double is a stand-in for the external Privy network call — the system
// code under test is the real implementation, not a mock.

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@boosters/db';
import { loadEnv, type Env } from '@boosters/config';
import { AuditService } from '../src/audit/audit.service.js';
import { AuthService } from '../src/auth/auth.service.js';
import { UsersService } from '../src/users/users.service.js';
import { KycService } from '../src/kyc/kyc.service.js';
import type { PrivyService } from '../src/auth/privy.service.js';

const prisma = new PrismaClient();
const audit = new AuditService(prisma);

function envWith(overrides: Record<string, string> = {}): Env {
  return loadEnv({
    DATABASE_URL:
      process.env.DATABASE_URL ?? 'postgresql://boosters:boosters@localhost:5432/boosters_test',
    ...overrides,
  } as NodeJS.ProcessEnv);
}

/** Minimal Privy profile matching what extractPrivyIdentity reads. */
function fakePrivy(privyId: string, email: string, wallet: string): PrivyService {
  return {
    getUser: async () => ({
      id: privyId,
      email: { address: email },
      linkedAccounts: [{ type: 'wallet', chainType: 'solana', address: wallet }],
    }),
  } as unknown as PrivyService;
}

async function cleanup() {
  await prisma.auditLog.deleteMany({ where: { entityType: 'User' } });
  await prisma.user.deleteMany({ where: { email: { contains: '@phase2.test' } } });
}

beforeEach(cleanup);
afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

describe('AuthService.syncUser', () => {
  it('creates a held USER on first login and is idempotent', async () => {
    const env = envWith();
    const auth = new AuthService(
      prisma,
      env,
      fakePrivy('did:1', 'alice@phase2.test', 'Wal1'),
      audit,
    );

    const first = await auth.syncUser('did:1');
    expect(first.role).toBe('USER');
    expect(first.hold).toBe('NEW_ACCOUNT');
    expect(first.email).toBe('alice@phase2.test');
    expect(first.walletAddress).toBe('Wal1');

    const second = await auth.syncUser('did:1');
    expect(second.id).toBe(first.id); // no duplicate
    const count = await prisma.user.count({ where: { privyId: 'did:1' } });
    expect(count).toBe(1);
  });

  it('auto-grants ADMIN to bootstrap emails', async () => {
    const env = envWith({ ADMIN_BOOTSTRAP_EMAILS: 'boss@phase2.test, other@phase2.test' });
    const auth = new AuthService(
      prisma,
      env,
      fakePrivy('did:2', 'boss@phase2.test', 'Wal2'),
      audit,
    );
    const user = await auth.syncUser('did:2');
    expect(user.role).toBe('ADMIN');
    expect(user.hold).toBe('NONE');
  });
});

describe('UsersService admin operations (audited)', () => {
  it('changes role and writes an audit entry', async () => {
    const env = envWith();
    const auth = new AuthService(
      prisma,
      env,
      fakePrivy('did:3', 'admin@phase2.test', 'Wal3'),
      audit,
    );
    const adminAuth = new AuthService(
      prisma,
      env,
      fakePrivy('did:4', 'u@phase2.test', 'Wal4'),
      audit,
    );
    const admin = await auth.syncUser('did:3');
    await prisma.user.update({ where: { id: admin.id }, data: { role: 'ADMIN' } });
    const target = await adminAuth.syncUser('did:4');

    const users = new UsersService(prisma, audit);
    const updated = await users.setRole({ ...admin, role: 'ADMIN' }, target.id, 'OPS');
    expect(updated.role).toBe('OPS');

    const log = await prisma.auditLog.findFirst({
      where: { entityId: target.id, action: 'ROLE_CHANGED' },
    });
    expect(log?.fromState).toBe('USER');
    expect(log?.toState).toBe('OPS');
  });

  it('prevents an admin from removing their own ADMIN role', async () => {
    const env = envWith();
    const auth = new AuthService(
      prisma,
      env,
      fakePrivy('did:5', 'self@phase2.test', 'Wal5'),
      audit,
    );
    const admin = await auth.syncUser('did:5');
    const users = new UsersService(prisma, audit);
    await expect(users.setRole({ ...admin, role: 'ADMIN' }, admin.id, 'USER')).rejects.toThrow();
  });
});

describe('KycService', () => {
  it('manual provider moves the user to PENDING (never auto-approves)', async () => {
    const env = envWith({ KYC_PROVIDER: 'manual' });
    const auth = new AuthService(prisma, env, fakePrivy('did:6', 'kyc@phase2.test', 'Wal6'), audit);
    const user = await auth.syncUser('did:6');
    const kyc = new KycService(prisma, env, audit);
    const res = await kyc.start(user);
    expect(res.status).toBe('PENDING');
    const fresh = await prisma.user.findUnique({ where: { id: user.id } });
    expect(fresh?.kycStatus).toBe('PENDING'); // not APPROVED
  });

  it('rejects a real provider while ENABLE_REAL_KYC is off', async () => {
    const env = envWith({ KYC_PROVIDER: 'sumsub' });
    const auth = new AuthService(
      prisma,
      env,
      fakePrivy('did:7', 'kyc2@phase2.test', 'Wal7'),
      audit,
    );
    const user = await auth.syncUser('did:7');
    const kyc = new KycService(prisma, env, audit);
    await expect(kyc.start(user)).rejects.toThrow(/disabled/);
  });
});
