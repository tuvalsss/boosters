import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuditModule } from './audit/audit.module.js';
import { LedgerModule } from './ledger/ledger.module.js';
import { AuthModule } from './auth/auth.module.js';
import { UsersModule } from './users/users.module.js';
import { VaultModule } from './vault/vault.module.js';
import { MarketplaceModule } from './marketplace/marketplace.module.js';
import { HealthController } from './health/health.controller.js';

/**
 * Root module. Phase 4 adds the double-entry ledger + marketplace (listings,
 * USDC buy with 2% fee, ownership move, on-chain settlement) on top of the
 * Phase 3 vault/minting foundation.
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
  ],
  controllers: [HealthController],
})
export class AppModule {}
