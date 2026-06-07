import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { IsObject, IsOptional, IsString } from 'class-validator';
import { Prisma, RedemptionStatus, type User } from '@boosters/db';
import { CurrentUser, Roles } from '../auth/auth.decorators.js';
import { RedeemService } from './redeem.service.js';

class RedeemDto {
  @IsString()
  vaultItemId!: string;
  @IsObject()
  shippingAddress!: Record<string, unknown>;
}
class ShipDto {
  @IsOptional()
  @IsString()
  trackingNumber?: string;
}

@Controller('redeem')
export class RedeemController {
  constructor(private readonly redeem: RedeemService) {}

  /** Burn the token, release the physical, open a shipping record. */
  @Post()
  request(@CurrentUser() user: User, @Body() dto: RedeemDto) {
    return this.redeem.redeem(user, dto.vaultItemId, dto.shippingAddress as Prisma.InputJsonValue);
  }

  @Get()
  mine(@CurrentUser() user: User) {
    return this.redeem.listMine(user.id);
  }
}

@Controller('admin/redemptions')
@Roles('ADMIN', 'OPS')
export class AdminRedeemController {
  constructor(private readonly redeem: RedeemService) {}

  @Get()
  list(@Query('status') status?: string) {
    const parsed =
      status && (Object.values(RedemptionStatus) as string[]).includes(status)
        ? (status as RedemptionStatus)
        : undefined;
    return this.redeem.listForOps(parsed);
  }

  @Post(':id/ship')
  ship(@CurrentUser() actor: User, @Param('id') id: string, @Body() dto: ShipDto) {
    return this.redeem.setStatus(actor, id, 'SHIPPED', dto.trackingNumber);
  }

  @Post(':id/delivered')
  delivered(@CurrentUser() actor: User, @Param('id') id: string) {
    return this.redeem.setStatus(actor, id, 'DELIVERED');
  }
}
