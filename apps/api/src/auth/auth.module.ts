import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PrivyService } from './privy.service.js';
import { AuthService } from './auth.service.js';
import { PrivyAuthGuard } from './auth.guard.js';
import { RolesGuard } from './roles.guard.js';

/**
 * Registers authentication globally: every route requires a valid Privy token
 * unless marked `@Public()`. RolesGuard runs after to enforce `@Roles()`.
 * Guard order follows provider registration order.
 */
@Module({
  providers: [
    PrivyService,
    AuthService,
    { provide: APP_GUARD, useClass: PrivyAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [PrivyService, AuthService],
})
export class AuthModule {}
