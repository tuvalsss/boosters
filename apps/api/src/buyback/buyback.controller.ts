import { Body, Controller, Param, Post, Get, Query } from '@nestjs/common';
import { IsString, Matches } from 'class-validator';
import type { User } from '@boosters/db';
import { CurrentUser, Roles } from '../auth/auth.decorators.js';
import { BuybackService } from './buyback.service.js';

const MONEY = /^\d+(\.\d{1,6})?$/;

class QuoteDto {
  @IsString()
  vaultItemId!: string;
}
class SetFmvDto {
  @IsString()
  vaultItemId!: string;
  @Matches(MONEY)
  valueUsdc!: string;
}
class CreditTreasuryDto {
  @Matches(MONEY)
  amountUsdc!: string;
}

@Controller('buyback')
export class BuybackController {
  constructor(private readonly buyback: BuybackService) {}

  /** Non-guaranteed, time-boxed buyback quote for an item you own. */
  @Post('quote')
  quote(@CurrentUser() user: User, @Body() dto: QuoteDto) {
    return this.buyback.quote(user, dto.vaultItemId);
  }

  @Post('quotes/:id/accept')
  accept(@CurrentUser() user: User, @Param('id') id: string) {
    return this.buyback.accept(user, id);
  }
}

@Controller('admin/buyback')
@Roles('ADMIN', 'OPS')
export class AdminBuybackController {
  constructor(private readonly buyback: BuybackService) {}

  @Get('treasury')
  status() {
    return this.buyback.treasuryStatus();
  }

  @Post('pause')
  pause(@CurrentUser() actor: User, @Query('paused') paused: string) {
    return this.buyback.setPaused(actor, paused !== 'false');
  }

  @Post('fmv')
  setFmv(@CurrentUser() actor: User, @Body() dto: SetFmvDto) {
    return this.buyback.setFmv(actor, dto.vaultItemId, dto.valueUsdc);
  }

  @Post('treasury/credit')
  credit(@CurrentUser() actor: User, @Body() dto: CreditTreasuryDto) {
    return this.buyback.creditTreasury(actor, dto.amountUsdc);
  }
}
