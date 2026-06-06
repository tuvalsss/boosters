import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module.js';
import { HealthController } from './health/health.controller.js';

/**
 * Root module. Phase 1 wires only configuration + health. Feature modules
 * (vault, marketplace, packs, raffles, buyback, ...) are added in later phases.
 */
@Module({
  imports: [ConfigModule],
  controllers: [HealthController],
})
export class AppModule {}
