import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuditModule } from './audit/audit.module.js';
import { AuthModule } from './auth/auth.module.js';
import { UsersModule } from './users/users.module.js';
import { HealthController } from './health/health.controller.js';

/**
 * Root module. Phase 2 adds real auth (Privy), RBAC and the users/admin/KYC
 * surface on top of the Phase 1 config + health foundation. Feature modules
 * (vault, marketplace, packs, raffles, buyback) arrive in later phases.
 */
@Module({
  imports: [ConfigModule, PrismaModule, AuditModule, AuthModule, UsersModule],
  controllers: [HealthController],
})
export class AppModule {}
