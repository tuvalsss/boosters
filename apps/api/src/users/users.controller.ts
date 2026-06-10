import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import { IsString, MaxLength } from 'class-validator';
import type { User } from '@boosters/db';
import { CurrentUser } from '../auth/auth.decorators.js';
import { UsersService } from './users.service.js';
import { publicUser, UpdateProfileDto } from './users.dto.js';

class ApplyReferralDto {
  @IsString()
  @MaxLength(32)
  code!: string;
}

/** Authenticated self-service profile endpoints. */
@Controller('me')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  me(@CurrentUser() user: User) {
    return publicUser(user);
  }

  @Patch()
  async updateMe(@CurrentUser() user: User, @Body() dto: UpdateProfileDto) {
    const updated = await this.users.updateProfile(user, dto.displayName ?? null);
    return publicUser(updated);
  }

  @Get('referrals')
  referrals(@CurrentUser() user: User) {
    return this.users.referralSummary(user);
  }

  @Post('referrals')
  applyReferral(@CurrentUser() user: User, @Body() dto: ApplyReferralDto) {
    return this.users.applyReferralCode(user, dto.code);
  }
}
