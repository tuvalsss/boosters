import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import type { User } from '@boosters/db';
import { CurrentUser, Public, Roles } from '../auth/auth.decorators.js';
import { MarketplaceService } from './marketplace.service.js';
import { BrowseQueryDto, BuyDto, CreateListingDto, CreditBalanceDto } from './marketplace.dto.js';

@Controller('marketplace')
export class MarketplaceController {
  constructor(private readonly marketplace: MarketplaceService) {}

  /** Public browse of active listings. */
  @Public()
  @Get('listings')
  browse(@Query() query: BrowseQueryDto) {
    return this.marketplace.browse(query);
  }

  @Public()
  @Get('listings/:id')
  getListing(@Param('id') id: string) {
    return this.marketplace.getListing(id);
  }

  /** Create a listing for an item you own (custody gate: VAULTED + active token). */
  @Post('listings')
  createListing(@CurrentUser() user: User, @Body() dto: CreateListingDto) {
    return this.marketplace.createListing(user, dto.vaultItemId, dto.priceUsdc);
  }

  @Delete('listings/:id')
  cancel(@CurrentUser() user: User, @Param('id') id: string) {
    return this.marketplace.cancelListing(user, id);
  }

  /** Buy a listing with custodial USDC (idempotent). */
  @Post('listings/:id/buy')
  buy(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: BuyDto) {
    return this.marketplace.buy(user, id, dto.idempotencyKey);
  }
}

@Controller('wallet')
export class WalletController {
  constructor(private readonly marketplace: MarketplaceService) {}

  /** Authenticated user's balance, holdings and order history. */
  @Get()
  wallet(@CurrentUser() user: User) {
    return this.marketplace.wallet(user.id);
  }

  /** Devnet on-ramp: staff credit a user's custodial USDC balance for testing. */
  @Post('credit')
  @Roles('ADMIN', 'OPS')
  credit(@CurrentUser() actor: User, @Body() dto: CreditBalanceDto) {
    return this.marketplace.creditBalance(actor, dto.userId, dto.amountUsdc);
  }
}
