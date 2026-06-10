import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Param,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import type { FastifyRequest } from 'fastify';
import type { User } from '@boosters/db';
import type { Env } from '@boosters/config';
import { ENV } from '../config/config.module.js';
import { CurrentUser, Public, Roles } from '../auth/auth.decorators.js';
import { PaymentsService } from './payments.service.js';

const MONEY = /^\d+(\.\d{1,6})?$/;

class OnrampDto {
  @Matches(MONEY)
  amountUsdc!: string;
}
class WithdrawalDto {
  @Matches(MONEY)
  amountUsdc!: string;

  @IsString()
  @MaxLength(40)
  destinationType!: string;

  @IsString()
  @MaxLength(240)
  destination!: string;
}
class WebhookDto {
  @IsString()
  reference!: string;
  @IsString()
  signature!: string;
}
class FailWithdrawalDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
type RawFastifyRequest = FastifyRequest & { rawBody?: Buffer };

@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly payments: PaymentsService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /** Start a USDC on-ramp; returns a checkout session. */
  @Post('onramp')
  onramp(@CurrentUser() user: User, @Body() dto: OnrampDto) {
    return this.payments.createOnramp(user, dto.amountUsdc);
  }

  /** Request a money-out withdrawal. Requires APPROVED KYC. */
  @Post('withdrawals')
  withdrawal(@CurrentUser() user: User, @Body() dto: WithdrawalDto) {
    return this.payments.requestWithdrawal(
      user,
      dto.amountUsdc,
      dto.destinationType,
      dto.destination,
    );
  }

  /** Sandbox only: simulate a successful payment for your own pending deposit. */
  @Post('sandbox/:ref/confirm')
  sandboxConfirm(@CurrentUser() user: User, @Param('ref') ref: string) {
    if (this.payments.mode !== 'sandbox') {
      throw new BadRequestException('Sandbox confirmation is disabled in live mode');
    }
    return this.payments.confirm(ref, user);
  }

  /** Provider webhook (e.g. Coinflow). HMAC-verified when an API key is set. */
  @Public()
  @Post('webhook')
  async webhook(@Body() dto: WebhookDto) {
    const secret = this.env.COINFLOW_API_KEY;
    if (secret) {
      const expected = createHmac('sha256', secret).update(dto.reference).digest('hex');
      const ok =
        dto.signature.length === expected.length &&
        timingSafeEqual(Buffer.from(dto.signature), Buffer.from(expected));
      if (!ok) throw new UnauthorizedException('Invalid webhook signature');
    }
    return this.payments.confirm(dto.reference);
  }

  /** Stripe Checkout webhook. Requires raw body + Stripe-Signature verification. */
  @Public()
  @Post('stripe/webhook')
  async stripeWebhook(
    @Req() req: RawFastifyRequest,
    @Headers('stripe-signature') signature?: string,
  ) {
    if (!signature) throw new UnauthorizedException('Missing Stripe signature');
    if (!req.rawBody) throw new BadRequestException('Missing raw body for Stripe verification');
    return this.payments.handleStripeWebhook(req.rawBody, signature);
  }
}

@Controller('admin/payments')
@Roles('ADMIN', 'OPS')
export class AdminPaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get('withdrawals')
  withdrawals() {
    return this.payments.listWithdrawals();
  }

  @Post('withdrawals/:id/complete')
  complete(
    @CurrentUser() actor: User,
    @Param('id') id: string,
    @Query('signature') signature?: string,
  ) {
    return this.payments.completeWithdrawal(actor, id, signature);
  }

  @Post('withdrawals/:id/fail')
  fail(@CurrentUser() actor: User, @Param('id') id: string, @Body() dto: FailWithdrawalDto) {
    return this.payments.failWithdrawal(actor, id, dto.reason);
  }
}
