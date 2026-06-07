import { Body, Controller, Get, Post } from '@nestjs/common';
import { IsString } from 'class-validator';
import type { User } from '@boosters/db';
import { CurrentUser, Public } from '../auth/auth.decorators.js';
import { KycService } from './kyc.service.js';

class KycWebhookDto {
  @IsString()
  userId!: string;
  @IsString()
  status!: string;
  @IsString()
  signature!: string;
}

@Controller('kyc')
export class KycController {
  constructor(private readonly kyc: KycService) {}

  @Get('status')
  status(@CurrentUser() user: User) {
    return this.kyc.getStatus(user);
  }

  @Post('start')
  start(@CurrentUser() user: User) {
    return this.kyc.start(user);
  }

  /** Provider webhook (Veriff/Sumsub). HMAC-verified; gated by ENABLE_REAL_KYC. */
  @Public()
  @Post('webhook')
  webhook(@Body() dto: KycWebhookDto) {
    return this.kyc.handleWebhook(dto);
  }
}
