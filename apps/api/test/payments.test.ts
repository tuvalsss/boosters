// DB-integration tests for the USDC on-ramp: pending deposit → confirm credits
// the custodial balance via a real double-entry DEPOSIT, idempotently.

import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient, type User } from '@boosters/db';
import { loadEnv } from '@boosters/config';
import { AuditService } from '../src/audit/audit.service.js';
import { LedgerService } from '../src/ledger/ledger.service.js';
import { PaymentsService } from '../src/payments/payments.service.js';

const prisma = new PrismaClient();
const audit = new AuditService(prisma);
const ledger = new LedgerService(prisma);
const env = loadEnv({
  DATABASE_URL:
    process.env.DATABASE_URL ?? 'postgresql://boosters:boosters@localhost:5432/boosters_test',
} as NodeJS.ProcessEnv);
const payments = new PaymentsService(prisma, env, ledger, audit);

async function makeUser(over: Partial<User> = {}): Promise<User> {
  return prisma.user.create({
    data: { email: `u_${randomUUID()}@phase10.test`, role: 'USER', hold: 'NONE', ...over },
  });
}
async function cleanup() {
  const users = await prisma.user.findMany({ where: { email: { contains: '@phase10.test' } } });
  const ids = users.map((u) => u.id);
  if (ids.length === 0) return;
  const orders = await prisma.order.findMany({
    where: { buyerId: { in: ids } },
    select: { id: true },
  });
  await prisma.ledgerEntry.deleteMany({ where: { orderId: { in: orders.map((o) => o.id) } } });
  await prisma.order.deleteMany({ where: { buyerId: { in: ids } } });
  await prisma.auditLog.deleteMany({ where: { actorId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
}
beforeEach(cleanup);
afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

describe('on-ramp', () => {
  it('creates a pending deposit then credits the balance on confirm', async () => {
    const user = await makeUser();
    const session = await payments.createOnramp(user, '250');
    expect(session.provider).toBe('sandbox');
    expect((await ledger.balanceOf(user.id)).toString()).toBe('0'); // pending, not credited

    await payments.confirm(session.reference, user);
    expect((await ledger.balanceOf(user.id)).toString()).toBe('250');
  });

  it('is idempotent — confirming twice credits once', async () => {
    const user = await makeUser();
    const session = await payments.createOnramp(user, '100');
    await payments.confirm(session.reference, user);
    await payments.confirm(session.reference, user);
    expect((await ledger.balanceOf(user.id)).toString()).toBe('100');
  });

  it("rejects confirming someone else's payment", async () => {
    const a = await makeUser();
    const b = await makeUser();
    const session = await payments.createOnramp(a, '50');
    await expect(payments.confirm(session.reference, b)).rejects.toThrow(/not your/i);
  });
});

describe('withdrawals', () => {
  it('allows deposits without KYC but blocks withdrawals until KYC is approved', async () => {
    const user = await makeUser({ kycStatus: 'NONE' });
    const session = await payments.createOnramp(user, '40');
    await payments.confirm(session.reference, user);
    expect((await ledger.balanceOf(user.id)).toString()).toBe('40');

    await expect(payments.requestWithdrawal(user, '10', 'USDC_WALLET', 'Wallet1')).rejects.toThrow(
      /KYC/i,
    );
  });

  it('creates a processing withdrawal and debits the custodial balance after KYC approval', async () => {
    const user = await makeUser({ kycStatus: 'APPROVED' });
    const session = await payments.createOnramp(user, '40');
    await payments.confirm(session.reference, user);

    const withdrawal = await payments.requestWithdrawal(user, '15', 'USDC_WALLET', 'Wallet1');
    expect(withdrawal.status).toBe('PROCESSING');
    expect((await ledger.balanceOf(user.id)).toString()).toBe('25');
  });
});
