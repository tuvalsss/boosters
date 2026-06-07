import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma, type Order, type PrismaClient, type User } from '@boosters/db';
import type { Env } from '@boosters/config';
import { ENV } from '../config/config.module.js';
import { PRISMA } from '../prisma/prisma.module.js';
import { AuditService } from '../audit/audit.service.js';
import { LedgerService } from '../ledger/ledger.service.js';

export interface OnrampSession {
  reference: string;
  provider: 'sandbox' | 'live';
  amountUsdc: string;
  /** Where the user completes payment (Coinflow when live; local sim in sandbox). */
  checkoutUrl: string;
}

/**
 * USDC on-ramp (spec §4). The custodial balance is credited only after a
 * confirmed payment: in sandbox the user confirms a simulated checkout; in live
 * mode a Coinflow webhook (HMAC-verified) confirms. Either way the credit is a
 * real double-entry DEPOSIT — no fake balances.
 */
@Injectable()
export class PaymentsService {
  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    @Inject(ENV) private readonly env: Env,
    private readonly ledger: LedgerService,
    private readonly audit: AuditService,
  ) {}

  get mode(): 'sandbox' | 'live' {
    return this.env.PAYMENTS_MODE === 'live' ? 'live' : 'sandbox';
  }

  /** Create a pending DEPOSIT order and a checkout session. */
  async createOnramp(user: User, amountUsdc: string): Promise<OnrampSession> {
    const amount = new Prisma.Decimal(amountUsdc);
    if (amount.lte(0)) throw new BadRequestException('Amount must be greater than zero');

    const order = await this.prisma.order.create({
      data: {
        type: 'DEPOSIT',
        status: 'PENDING',
        buyerId: user.id,
        amountUsdc: amount,
        idempotencyKey: `onramp_${randomUUID()}`,
      },
    });
    await this.audit.log({
      actorId: user.id,
      entityType: 'Order',
      entityId: order.id,
      action: 'ONRAMP_CREATED',
      metadata: { amountUsdc },
    });

    const checkoutUrl =
      this.mode === 'live' && this.env.COINFLOW_MERCHANT_ID
        ? `https://app.coinflow.cash/checkout/${this.env.COINFLOW_MERCHANT_ID}?ref=${order.id}&amount=${amountUsdc}`
        : `/payments/sandbox/${order.id}`;

    return { reference: order.id, provider: this.mode, amountUsdc: amount.toString(), checkoutUrl };
  }

  /**
   * Confirm a payment and credit the custodial balance. Idempotent. In sandbox
   * the order owner may confirm (simulated success); in live mode only a
   * verified webhook should call this.
   */
  async confirm(reference: string, actor?: User): Promise<Order> {
    const order = await this.prisma.order.findUnique({ where: { id: reference } });
    if (!order || order.type !== 'DEPOSIT') throw new NotFoundException('Payment not found');
    if (order.status === 'COMPLETED') return order; // idempotent
    if (order.status !== 'PENDING') throw new BadRequestException(`Payment is ${order.status}`);
    if (actor && order.buyerId !== actor.id) throw new ForbiddenException('Not your payment');

    const completed = await this.prisma.$transaction(async (tx) => {
      await this.ledger.post(tx, order.id, [
        {
          accountType: 'EXTERNAL',
          direction: 'DEBIT',
          amountUsdc: order.amountUsdc,
          memo: 'On-ramp',
        },
        {
          accountType: 'USER_WALLET',
          userId: order.buyerId!,
          direction: 'CREDIT',
          amountUsdc: order.amountUsdc,
          memo: 'On-ramp deposit',
        },
      ]);
      return tx.order.update({ where: { id: order.id }, data: { status: 'COMPLETED' } });
    });
    await this.audit.log({
      actorId: order.buyerId,
      entityType: 'Order',
      entityId: order.id,
      action: 'ONRAMP_CONFIRMED',
      metadata: { amountUsdc: order.amountUsdc.toString() },
    });
    return completed;
  }
}
