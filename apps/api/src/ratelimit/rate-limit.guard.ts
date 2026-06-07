import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { User } from '@boosters/db';
import type { Env } from '@boosters/config';
import { ENV } from '../config/config.module.js';
import { RateLimitService } from './rate-limit.service.js';

export type RateLimitAction = 'listing' | 'submission';
export const RATE_LIMIT_KEY = 'rateLimit';

/** Apply a per-day rate limit for `action` to a route. */
export const RateLimit = (action: RateLimitAction) => SetMetadata(RATE_LIMIT_KEY, action);

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly limiter: RateLimitService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const action = this.reflector.getAllAndOverride<RateLimitAction>(RATE_LIMIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!action) return true;

    const { user } = context.switchToHttp().getRequest<{ user?: User }>();
    if (!user) return true; // auth guard handles unauthenticated requests

    const perDay =
      action === 'listing'
        ? this.env.RATE_LIMIT_LISTINGS_PER_DAY
        : this.env.RATE_LIMIT_SUBMISSIONS_PER_DAY;

    const { allowed } = await this.limiter.hit(action, user.id, perDay);
    if (!allowed) {
      throw new HttpException(
        `Daily ${action} limit reached (${perDay}). Try again tomorrow.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }
}
