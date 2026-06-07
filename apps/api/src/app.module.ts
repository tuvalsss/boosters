import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuditModule } from './audit/audit.module.js';
import { AuthModule } from './auth/auth.module.js';
import { UsersModule } from './users/users.module.js';
import { VaultModule } from './vault/vault.module.js';
import { HealthController } from './health/health.controller.js';

/**
 * Root module. Phase 3 adds the vault state machine + admin intake/grading +
 * real Bubblegum cNFT minting (custody gate) on top of Phase 2 auth/RBAC.
 */
@Module({
  imports: [ConfigModule, PrismaModule, AuditModule, AuthModule, UsersModule, VaultModule],
  controllers: [HealthController],
})
export class AppModule {}
