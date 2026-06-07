import { Global, Module } from '@nestjs/common';
import { Redis } from 'ioredis';
import type { Env } from '@boosters/config';
import { ENV } from '../config/config.module.js';
import { RateLimitService, REDIS } from './rate-limit.service.js';
import { RateLimitGuard } from './rate-limit.guard.js';

@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      useFactory: (env: Env) =>
        new Redis(env.REDIS_URL, {
          lazyConnect: true,
          maxRetriesPerRequest: 1,
          enableOfflineQueue: false,
        }),
      inject: [ENV],
    },
    RateLimitService,
    RateLimitGuard,
  ],
  exports: [RateLimitService, RateLimitGuard],
})
export class RateLimitModule {}
