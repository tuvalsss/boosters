import { Body, Controller, Get, Patch } from '@nestjs/common';
import type { User } from '@boosters/db';
import { CurrentUser } from '../auth/auth.decorators.js';
import { UsersService } from './users.service.js';
import { publicUser, UpdateProfileDto } from './users.dto.js';

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
}
