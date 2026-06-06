import { describe, expect, it } from 'vitest';
import { isSafeMode, loadEnv } from '@boosters/config';

// Phase-1 smoke test: the API boots in safe mode by default. Full e2e against
// a live Nest instance + Postgres is added alongside feature modules.
describe('api safe-mode boot contract', () => {
  it('default env resolves to safe mode', () => {
    const env = loadEnv({
      DATABASE_URL: 'postgresql://boosters:boosters@localhost:5432/boosters',
    } as NodeJS.ProcessEnv);
    expect(isSafeMode(env)).toBe(true);
  });
});
