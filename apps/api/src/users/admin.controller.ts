import { Body, Controller, Get, Inject, Param, Patch, Query } from '@nestjs/common';
import type { PrismaClient, User } from '@boosters/db';
import { CurrentUser, Roles } from '../auth/auth.decorators.js';
import { PRISMA } from '../prisma/prisma.module.js';
import { UsersService } from './users.service.js';
import { ListUsersQueryDto, publicUser, SetHoldDto, SetKycDto, SetRoleDto } from './users.dto.js';

/**
 * Admin / Ops console API. Every route is role-gated and every mutation is
 * written to the audit log by UsersService. ADMIN can change roles; OPS can
 * manage KYC/holds and read the queue.
 */
@Controller('admin')
@Roles('ADMIN', 'OPS')
export class AdminController {
  constructor(
    private readonly users: UsersService,
    @Inject(PRISMA) private readonly prisma: PrismaClient,
  ) {}

  @Get('users')
  async listUsers(@Query() query: ListUsersQueryDto) {
    const { items, total } = await this.users.list(query);
    return { items: items.map(publicUser), total };
  }

  @Patch('users/:id/role')
  @Roles('ADMIN') // role changes are ADMIN-only
  async setRole(@CurrentUser() actor: User, @Param('id') id: string, @Body() dto: SetRoleDto) {
    return publicUser(await this.users.setRole(actor, id, dto.role));
  }

  @Patch('users/:id/kyc')
  async setKyc(@CurrentUser() actor: User, @Param('id') id: string, @Body() dto: SetKycDto) {
    return publicUser(await this.users.setKyc(actor, id, dto.status));
  }

  @Patch('users/:id/hold')
  async setHold(@CurrentUser() actor: User, @Param('id') id: string, @Body() dto: SetHoldDto) {
    return publicUser(await this.users.setHold(actor, id, dto.hold));
  }

  /** Recent audit-log entries for the ops console. */
  @Get('audit')
  async audit(@Query('take') take?: string) {
    const n = Math.min(Number(take) || 50, 200);
    return this.prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: n });
  }
}
