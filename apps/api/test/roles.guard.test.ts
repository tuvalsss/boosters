import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import type { User, UserRole } from '@boosters/db';
import { describe, expect, it } from 'vitest';
import { RolesGuard } from '../src/auth/roles.guard.js';

function makeContext(user?: Partial<User>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

function makeGuard(required: UserRole[] | undefined): RolesGuard {
  const reflector = { getAllAndOverride: () => required } as unknown as Reflector;
  return new RolesGuard(reflector);
}

describe('RolesGuard', () => {
  it('allows any authenticated user when no roles are required', () => {
    const guard = makeGuard(undefined);
    expect(guard.canActivate(makeContext({ role: 'USER' }))).toBe(true);
  });

  it('allows a user whose role is in the required set', () => {
    const guard = makeGuard(['ADMIN', 'OPS']);
    expect(guard.canActivate(makeContext({ role: 'OPS' }))).toBe(true);
  });

  it('forbids a user whose role is not in the required set', () => {
    const guard = makeGuard(['ADMIN']);
    expect(() => guard.canActivate(makeContext({ role: 'USER' }))).toThrow(ForbiddenException);
  });

  it('forbids when there is no authenticated user', () => {
    const guard = makeGuard(['ADMIN']);
    expect(() => guard.canActivate(makeContext(undefined))).toThrow(ForbiddenException);
  });
});
