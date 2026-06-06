import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import type { User } from '@boosters/db';
import { IS_PUBLIC } from './auth.decorators.js';
import { PrivyService } from './privy.service.js';
import { AuthService } from './auth.service.js';

/**
 * Global authentication guard. Verifies the Privy access token on the
 * Authorization header, resolves the DB user, and attaches it to the request.
 * Routes marked `@Public()` are skipped.
 */
@Injectable()
export class PrivyAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly privy: PrivyService,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<FastifyRequest & { user?: User }>();
    const token = extractBearer(req.headers.authorization);
    if (!token) throw new UnauthorizedException('Missing bearer token');

    const claims = await this.privy.verifyAccessToken(token);
    req.user = await this.auth.syncUser(claims.userId);
    return true;
  }
}

function extractBearer(header?: string): string | null {
  if (!header) return null;
  const [scheme, value] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && value ? value : null;
}
