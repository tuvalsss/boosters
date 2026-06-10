import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import Stripe from 'stripe';
import { Prisma, type Order, type PrismaClient, type User } from '@boosters/db';
import type { Env } from '@boosters/config';
import { ENV } from '../config/config.module.js';
import { PRISMA } from '../prisma/prisma.module.js';
import { AuditService } from '../audit/audit.service.js';
import { LedgerService } from '../ledger/ledger.service.js';

export interface OnrampSession {
  reference: string;
  provider: 'sandbox' | 'coinflow' | 'stripe';
  amountUsdc: string;
  /** Where the user completes payment (Stripe/Coinflow when live; local sim in sandbox). */
  checkoutUrl: string;
}

export interface WithdrawalRequest {
  id: string;
  status: string;
  amountUsdc: string;
  destinationType: string;
  destination: string;
}

/**
 * USDC on-ramp. The custodial balance is credited only after a confirmed
 * payment: in sandbox the user confirms a simulated checkout; in live mode a
 * provider webhook (Stripe signature or Coinflow HMAC) confirms. Either way the
 * credit is a real double-entry DEPOSIT, no fake balances.
 */
@Injectable()
export class PaymentsService {
  private stripe: InstanceType<typeof Stripe> | null = null;

  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    @Inject(ENV) private readonly env: Env,
    private readonly ledger: LedgerService,
    private readonly audit: AuditService,
  ) {}

  get mode(): 'sandbox' | 'live' {
    return this.env.PAYMENTS_MODE === 'live' ? 'live' : 'sandbox';
  }

  get provider(): 'sandbox' | 'coinflow' | 'stripe' {
    if (this.mode === 'sandbox') return 'sandbox';
    return this.env.PAYMENTS_PROVIDER;
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

    if (this.provider === 'stripe') {
      const checkoutUrl = await this.createStripeCheckout(order, user);
      return {
        reference: order.id,
        provider: 'stripe',
        amountUsdc: amount.toString(),
        checkoutUrl,
      };
    }

    if (this.provider === 'coinflow' && !this.env.COINFLOW_MERCHANT_ID) {
      throw new BadRequestException('COINFLOW_MERCHANT_ID is required for Coinflow payments');
    }

    const checkoutUrl =
      this.provider === 'coinflow'
        ? `https://app.coinflow.cash/checkout/${this.env.COINFLOW_MERCHANT_ID}?ref=${order.id}&amount=${amountUsdc}`
        : `/payments/sandbox/${order.id}`;

    return {
      reference: order.id,
      provider: this.provider,
      amountUsdc: amount.toString(),
      checkoutUrl,
    };
  }

  /**
   * Confirm a payment and credit the custodial balance. Idempotent. In sandbox
   * the order owner may confirm (simulated success); in live mode only a verified
   * provider webhook should call this.
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

  async handleStripeWebhook(rawBody: Buffer, signature: string) {
    if (!this.env.STRIPE_WEBHOOK_SECRET) {
      throw new BadRequestException('Stripe webhook secret is not configured');
    }
    const event = this.getStripe().webhooks.constructEvent(
      rawBody,
      signature,
      this.env.STRIPE_WEBHOOK_SECRET,
    );

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as {
        payment_status?: string;
        metadata?: { reference?: string };
      };
      if (session.payment_status !== 'paid') {
        return { received: true, ignored: 'checkout.session.completed without paid status' };
      }
      const reference = session.metadata?.reference;
      if (!reference) throw new BadRequestException('Stripe session is missing payment reference');
      const order = await this.confirm(reference);
      return { received: true, orderId: order.id, status: order.status };
    }

    return { received: true, ignored: event.type };
  }

  /**
   * Money-out path. KYC is mandatory here only: users may sign up and deposit
   * without KYC, but withdrawals require APPROVED manual/provider review first.
   */
  async requestWithdrawal(
    user: User,
    amountUsdc: string,
    destinationType: string,
    destination: string,
  ): Promise<WithdrawalRequest> {
    if (user.kycStatus !== 'APPROVED') {
      throw new ForbiddenException('KYC approval is required before withdrawals');
    }
    if (user.hold === 'SUSPENDED') throw new ForbiddenException('Account suspended');

    const amount = new Prisma.Decimal(amountUsdc);
    if (amount.lte(0)) throw new BadRequestException('Amount must be greater than zero');
    if (!destination.trim()) throw new BadRequestException('Withdrawal destination is required');

    const balance = await this.ledger.balanceOf(user.id);
    if (balance.lt(amount)) {
      throw new BadRequestException(
        `Insufficient USDC balance: have ${balance.toString()}, need ${amount.toString()}`,
      );
    }

    const metadata = {
      destinationType: destinationType.trim().slice(0, 40),
      destination: destination.trim().slice(0, 240),
      requestedAt: new Date().toISOString(),
    };

    const order = await this.prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          type: 'WITHDRAWAL',
          status: 'PROCESSING',
          buyerId: user.id,
          amountUsdc: amount,
          idempotencyKey: `withdrawal_${randomUUID()}`,
          metadata: metadata as Prisma.InputJsonValue,
        },
      });
      await this.ledger.post(tx, created.id, [
        {
          accountType: 'USER_WALLET',
          userId: user.id,
          direction: 'DEBIT',
          amountUsdc: amount,
          memo: 'Withdrawal request',
        },
        {
          accountType: 'EXTERNAL',
          direction: 'CREDIT',
          amountUsdc: amount,
          memo: 'Withdrawal destination',
        },
      ]);
      return created;
    });

    await this.audit.log({
      actorId: user.id,
      entityType: 'Order',
      entityId: order.id,
      action: 'WITHDRAWAL_REQUESTED',
      metadata: { amountUsdc, destinationType: metadata.destinationType },
    });

    return {
      id: order.id,
      status: order.status,
      amountUsdc: order.amountUsdc.toString(),
      destinationType: metadata.destinationType,
      destination: metadata.destination,
    };
  }

  async listWithdrawals() {
    return this.prisma.order.findMany({
      where: { type: 'WITHDRAWAL' },
      include: {
        buyer: { select: { id: true, email: true, walletAddress: true, kycStatus: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async completeWithdrawal(actor: User, orderId: string, onchainSignature?: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.type !== 'WITHDRAWAL') throw new NotFoundException('Withdrawal not found');
    if (order.status === 'COMPLETED') return order;
    if (order.status !== 'PROCESSING' && order.status !== 'PENDING') {
      throw new BadRequestException(`Withdrawal is ${order.status}`);
    }
    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'COMPLETED', onchainSignature: onchainSignature || null },
    });
    await this.audit.log({
      actorId: actor.id,
      entityType: 'Order',
      entityId: orderId,
      action: 'WITHDRAWAL_COMPLETED',
      fromState: order.status,
      toState: 'COMPLETED',
      metadata: { onchainSignature: onchainSignature ?? null },
    });
    return updated;
  }

  async failWithdrawal(actor: User, orderId: string, reason?: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.type !== 'WITHDRAWAL') throw new NotFoundException('Withdrawal not found');
    if (order.status === 'FAILED') return order;
    if (order.status === 'COMPLETED')
      throw new BadRequestException('Completed withdrawals cannot fail');
    const updated = await this.prisma.$transaction(async (tx) => {
      await this.ledger.post(tx, order.id, [
        {
          accountType: 'EXTERNAL',
          direction: 'DEBIT',
          amountUsdc: order.amountUsdc,
          memo: 'Withdrawal refund',
        },
        {
          accountType: 'USER_WALLET',
          userId: order.buyerId!,
          direction: 'CREDIT',
          amountUsdc: order.amountUsdc,
          memo: 'Withdrawal failed refund',
        },
      ]);
      return tx.order.update({ where: { id: orderId }, data: { status: 'FAILED' } });
    });
    await this.audit.log({
      actorId: actor.id,
      entityType: 'Order',
      entityId: orderId,
      action: 'WITHDRAWAL_FAILED',
      fromState: order.status,
      toState: 'FAILED',
      metadata: { reason: reason ?? null },
    });
    return updated;
  }

  private async createStripeCheckout(order: Order, user: User): Promise<string> {
    const cents = Math.round(Number(order.amountUsdc.toString()) * 100);
    if (!Number.isSafeInteger(cents) || cents <= 0) {
      throw new BadRequestException('Stripe amount must resolve to a positive cent amount');
    }

    const session = await this.getStripe().checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: user.email ?? undefined,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: cents,
            product_data: {
              name: `Boosters balance top-up (${order.amountUsdc.toString()} USDC)`,
            },
          },
        },
      ],
      metadata: {
        reference: order.id,
        userId: user.id,
        purpose: 'boosters_usdc_onramp',
      },
      success_url: appendStripeSession(
        this.env.STRIPE_SUCCESS_URL ?? 'http://localhost:3100/portfolio',
      ),
      cancel_url: this.env.STRIPE_CANCEL_URL ?? 'http://localhost:3100/portfolio',
    });

    if (!session.url) throw new BadRequestException('Stripe did not return a checkout URL');
    await this.prisma.order.update({
      where: { id: order.id },
      data: {
        metadata: {
          provider: 'stripe',
          stripeSessionId: session.id,
        },
      },
    });
    return session.url;
  }

  private getStripe(): InstanceType<typeof Stripe> {
    if (!this.env.STRIPE_SECRET_KEY) {
      throw new BadRequestException('STRIPE_SECRET_KEY is required for Stripe payments');
    }
    this.stripe ??= new Stripe(this.env.STRIPE_SECRET_KEY, {
      apiVersion: '2026-05-27.dahlia',
      typescript: true,
    });
    return this.stripe;
  }
}

function appendStripeSession(url: string): string {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}payment=stripe_success&session_id={CHECKOUT_SESSION_ID}`;
}
