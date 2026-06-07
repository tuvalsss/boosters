import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuditModule } from './audit/audit.module.js';
import { LedgerModule } from './ledger/ledger.module.js';
import { SettingsModule } from './settings/settings.module.js';
import { AuthModule } from './auth/auth.module.js';
import { UsersModule } from './users/users.module.js';
import { VaultModule } from './vault/vault.module.js';
import { MarketplaceModule } from './marketplace/marketplace.module.js';
import { SubmissionsModule } from './submissions/submissions.module.js';
import { PacksModule } from './packs/packs.module.js';
import { BuybackModule } from './buyback/buyback.module.js';
import { HealthController } from './health/health.controller.js';

/**
 * Root module. Phase 7 adds buyback (FMV quotes, treasury float floor guard,
 * USDC payouts, pause flag) on top of the Phase 6 foundation.
 */
@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    AuditModule,
    LedgerModule,
    SettingsModule,
    AuthModule,
    UsersModule,
    VaultModule,
    MarketplaceModule,
    SubmissionsModule,
    PacksModule,
    BuybackModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
