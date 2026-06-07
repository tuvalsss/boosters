import { Inject, Injectable } from '@nestjs/common';
import { Prisma, type LedgerAccountType, type PrismaClient } from '@boosters/db';
import { PRISMA } from '../prisma/prisma.module.js';

/** One side of a double-entry posting. */
export interface LedgerLine {
  accountType: LedgerAccountType;
  userId?: string | null;
  direction: 'DEBIT' | 'CREDIT';
  amountUsdc: Prisma.Decimal | string | number;
  memo?: string;
}

/**
 * Double-entry ledger (spec §5). Every order's lines must net to zero — that is
 * enforced at COMMIT by the deferred `LedgerEntry_balanced` DB trigger, so a
 * mis-posted money path can never be persisted. This service is the only place
 * ledger rows are written.
 */
@Injectable()
export class LedgerService {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  /** Post the given lines for an order within an existing transaction. */
  async post(tx: Prisma.TransactionClient, orderId: string, lines: LedgerLine[]): Promise<void> {
    await tx.ledgerEntry.createMany({
      data: lines.map((l) => ({
        orderId,
        accountType: l.accountType,
        userId: l.userId ?? null,
        direction: l.direction,
        amountUsdc: new Prisma.Decimal(l.amountUsdc),
        memo: l.memo ?? null,
      })),
    });
  }

  /** A user's custodial USDC balance = credits − debits on their USER_WALLET rows. */
  async balanceOf(userId: string): Promise<Prisma.Decimal> {
    const rows = await this.prisma.ledgerEntry.groupBy({
      by: ['direction'],
      where: { accountType: 'USER_WALLET', userId },
      _sum: { amountUsdc: true },
    });
    let credit = new Prisma.Decimal(0);
    let debit = new Prisma.Decimal(0);
    for (const r of rows) {
      const sum = r._sum.amountUsdc ?? new Prisma.Decimal(0);
      if (r.direction === 'CREDIT') credit = credit.add(sum);
      else debit = debit.add(sum);
    }
    return credit.sub(debit);
  }

  /** Total platform treasury balance (credits − debits on TREASURY). */
  async treasuryBalance(): Promise<Prisma.Decimal> {
    const rows = await this.prisma.ledgerEntry.groupBy({
      by: ['direction'],
      where: { accountType: 'TREASURY' },
      _sum: { amountUsdc: true },
    });
    let credit = new Prisma.Decimal(0);
    let debit = new Prisma.Decimal(0);
    for (const r of rows) {
      const sum = r._sum.amountUsdc ?? new Prisma.Decimal(0);
      if (r.direction === 'CREDIT') credit = credit.add(sum);
      else debit = debit.add(sum);
    }
    return credit.sub(debit);
  }
}
