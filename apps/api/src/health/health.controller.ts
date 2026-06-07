import { Controller, Get, Inject } from '@nestjs/common';
import { prisma } from '@boosters/db';
import type { Env } from '@boosters/config';
import { isSafeMode } from '@boosters/config';
import { ENV } from '../config/config.module.js';
import { Public } from '../auth/auth.decorators.js';
import { REDIS, type RedisLike } from '../ratelimit/rate-limit.service.js';

@Controller('health')
@Public()
export class HealthController {
  constructor(
    @Inject(ENV) private readonly env: Env,
    @Inject(REDIS) private readonly redis: RedisLike & { ping?: () => Promise<string> },
  ) {}

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

  /** Readiness — dependencies (Postgres, Redis) reachable. */
  @Get('ready')
  async ready() {
    const database = await this.check(() => prisma.$queryRaw`SELECT 1`);
    const redis = await this.check(
      () => this.redis.ping?.() ?? Promise.reject(new Error('no ping')),
    );
    const ok = database === 'up' && redis === 'up';
    return { status: ok ? 'ready' : 'degraded', checks: { database, redis } };
  }

  private async check(fn: () => Promise<unknown>): Promise<'up' | 'down'> {
    try {
      await fn();
      return 'up';
    } catch {
      return 'down';
    }
  }
}
