import { Global, Module } from '@nestjs/common';
import { assertSafeMode, bootstrapEnv, type Env } from '@boosters/config';

export const ENV = Symbol('ENV');

/**
 * Loads the single root `.env`, validates it, and asserts safe (devnet/sandbox)
 * mode once at boot. Exposed globally so any provider can inject `Env`.
 */
@Global()
@Module({
  providers: [
    {
      provide: ENV,
      useFactory: (): Env => {
        const env = bootstrapEnv();
        assertSafeMode(env);
        return env;
      },
    },
  ],
  exports: [ENV],
})
export class ConfigModule {}
