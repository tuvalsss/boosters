import { Controller, Get, Post } from '@nestjs/common';
import type { User } from '@boosters/db';
import { CurrentUser } from '../auth/auth.decorators.js';
import { KycService } from './kyc.service.js';

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
}
