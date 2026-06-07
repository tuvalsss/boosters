import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuditModule } from './audit/audit.module.js';
import { LedgerModule } from './ledger/ledger.module.js';
import { AuthModule } from './auth/auth.module.js';
import { UsersModule } from './users/users.module.js';
import { VaultModule } from './vault/vault.module.js';
import { MarketplaceModule } from './marketplace/marketplace.module.js';
import { SubmissionsModule } from './submissions/submissions.module.js';
import { HealthController } from './health/health.controller.js';

/**
 * Root module. Phase 5 adds the consignment (submit) flow on top of the
 * Phase 4 marketplace/ledger foundation.
 */
@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    AuditModule,
    LedgerModule,
    AuthModule,
    UsersModule,
    VaultModule,
    MarketplaceModule,
    SubmissionsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
