import { createParamDecorator, SetMetadata, type ExecutionContext } from '@nestjs/common';
import type { User, UserRole } from '@boosters/db';

/** Marks a route as not requiring authentication. */
export const IS_PUBLIC = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** Restricts a route to the given roles (checked by RolesGuard). */
export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

/** Injects the authenticated DB user attached by PrivyAuthGuard. */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): User => {
  const req = ctx.switchToHttp().getRequest<{ user?: User }>();
  if (!req.user) throw new Error('CurrentUser used on a route without authentication');
  return req.user;
});
