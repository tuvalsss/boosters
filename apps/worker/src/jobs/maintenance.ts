// Real maintenance jobs run by the worker. Pure functions over Prisma so they
// can be unit-tested against Postgres without Redis/BullMQ.

import type { PrismaClient } from '@boosters/db';

/** Expire buyback quotes whose time-box has lapsed (QUOTED → EXPIRED). */
export async function expireBuybackQuotes(prisma: PrismaClient): Promise<number> {
  const res = await prisma.buybackQuote.updateMany({
    where: { status: 'QUOTED', expiresAt: { lt: new Date() } },
    data: { status: 'EXPIRED' },
  });
  return res.count;
}

/** Fail abandoned on-ramp checkouts that were never confirmed. */
export async function expireStaleOnramps(
  prisma: PrismaClient,
  olderThanMs = 60 * 60 * 1000,
): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanMs);
  const res = await prisma.order.updateMany({
    where: { type: 'DEPOSIT', status: 'PENDING', createdAt: { lt: cutoff } },
    data: { status: 'FAILED' },
  });
  return res.count;
}

/** Treasury balance (credits − debits) — used for the float-floor alert. */
export async function treasuryBalanceUsdc(prisma: PrismaClient): Promise<number> {
  const rows = await prisma.ledgerEntry.groupBy({
    by: ['direction'],
    where: { accountType: 'TREASURY' },
    _sum: { amountUsdc: true },
  });
  let credit = 0;
  let debit = 0;
  for (const r of rows) {
    const v = Number(r._sum.amountUsdc ?? 0);
    if (r.direction === 'CREDIT') credit += v;
    else debit += v;
  }
  return credit - debit;
}
