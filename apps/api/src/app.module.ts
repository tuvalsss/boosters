import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuditModule } from './audit/audit.module.js';
import { LedgerModule } from './ledger/ledger.module.js';
import { SettingsModule } from './settings/settings.module.js';
import { RateLimitModule } from './ratelimit/rate-limit.module.js';
import { AuthModule } from './auth/auth.module.js';
import { UsersModule } from './users/users.module.js';
import { VaultModule } from './vault/vault.module.js';
import { MarketplaceModule } from './marketplace/marketplace.module.js';
import { SubmissionsModule } from './submissions/submissions.module.js';
import { PacksModule } from './packs/packs.module.js';
import { BuybackModule } from './buyback/buyback.module.js';
import { RafflesModule } from './raffles/raffles.module.js';
import { RedeemModule } from './redeem/redeem.module.js';
import { HealthController } from './health/health.controller.js';

/**
 * Root module. Phase 8 adds raffles + redeem/claim on top of the Phase 7
 * foundation.
 */
@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    AuditModule,
    LedgerModule,
    SettingsModule,
    RateLimitModule,
    AuthModule,
    UsersModule,
    VaultModule,
    MarketplaceModule,
    SubmissionsModule,
    PacksModule,
    BuybackModule,
    RafflesModule,
    RedeemModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
