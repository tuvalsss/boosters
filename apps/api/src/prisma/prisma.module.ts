import { Global, Module } from '@nestjs/common';
import { prisma } from '@boosters/db';

/** Injectable token for the shared Prisma client (override in tests). */
export const PRISMA = Symbol('PRISMA');

@Global()
@Module({
  providers: [{ provide: PRISMA, useValue: prisma }],
  exports: [PRISMA],
})
export class PrismaModule {}
