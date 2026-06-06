import { Controller, Get, Inject } from '@nestjs/common';
import { prisma } from '@boosters/db';
import type { Env } from '@boosters/config';
import { isSafeMode } from '@boosters/config';
import { ENV } from '../config/config.module.js';
import { Public } from '../auth/auth.decorators.js';

@Controller('health')
@Public()
export class HealthController {
  constructor(@Inject(ENV) private readonly env: Env) {}

  /** Liveness — process is up. */
  @Get()
  health() {
    return {
      status: 'ok',
      service: 'boosters-api',
      cluster: this.env.SOLANA_CLUSTER,
      paymentsMode: this.env.PAYMENTS_MODE,
      safeMode: isSafeMode(this.env),
      timestamp: new Date().toISOString(),
    };
  }

  /** Readiness — dependencies (Postgres) reachable. */
  @Get('ready')
  async ready() {
    let database = 'down';
    try {
      await prisma.$queryRaw`SELECT 1`;
      database = 'up';
    } catch {
      database = 'down';
    }
    return {
      status: database === 'up' ? 'ready' : 'degraded',
      checks: { database },
    };
  }
}
