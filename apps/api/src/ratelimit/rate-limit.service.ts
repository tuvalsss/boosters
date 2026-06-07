import { Inject, Injectable, Logger } from '@nestjs/common';

export const REDIS = Symbol('REDIS');

/** Minimal Redis surface we depend on (so tests can supply a fake). */
export interface RedisLike {
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
}

/**
 * Per-account, per-action daily rate limits (spec §7) backed by Redis. Fixed
 * UTC-day window. Fails OPEN on Redis errors so an outage never blocks the
 * platform (it only weakens this secondary defense; the custody gate stands).
 */
@Injectable()
export class RateLimitService {
  private readonly logger = new Logger(RateLimitService.name);

  constructor(@Inject(REDIS) private readonly redis: RedisLike) {}

  async hit(
    action: string,
    userId: string,
    perDay: number,
  ): Promise<{ allowed: boolean; count: number }> {
    const day = new Date().toISOString().slice(0, 10);
    const key = `rl:${action}:${userId}:${day}`;
    try {
      const count = await this.redis.incr(key);
      if (count === 1) await this.redis.expire(key, 86_400);
      return { allowed: count <= perDay, count };
    } catch (err) {
      this.logger.warn(`Rate limit check failed open for ${key}: ${(err as Error).message}`);
      return { allowed: true, count: 0 };
    }
  }
}
