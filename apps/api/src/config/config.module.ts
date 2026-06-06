import { Global, Module } from '@nestjs/common';
import { assertSafeMode, loadEnv, type Env } from '@boosters/config';

export const ENV = Symbol('ENV');

/**
 * Loads + validates env once at boot and asserts safe (devnet/sandbox) mode.
 * Exposed globally so any provider can inject the validated `Env`.
 */
@Global()
@Module({
  providers: [
    {
      provide: ENV,
      useFactory: (): Env => {
        const env = loadEnv();
        assertSafeMode(env);
        return env;
      },
    },
  ],
  exports: [ENV],
})
export class ConfigModule {}
