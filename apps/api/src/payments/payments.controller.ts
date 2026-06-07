import {
  BadRequestException,
  Body,
  Controller,
  Inject,
  Param,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { IsString, Matches } from 'class-validator';
import type { User } from '@boosters/db';
import type { Env } from '@boosters/config';
import { ENV } from '../config/config.module.js';
import { CurrentUser, Public } from '../auth/auth.decorators.js';
import { PaymentsService } from './payments.service.js';

const MONEY = /^\d+(\.\d{1,6})?$/;

class OnrampDto {
  @Matches(MONEY)
  amountUsdc!: string;
}
class WebhookDto {
  @IsString()
  reference!: string;
  @IsString()
  signature!: string;
}

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
}
