import { describe, expect, it } from 'vitest';
import { assertSafeMode, isSafeMode, loadEnv } from '../src/index.js';

const base = {
  DATABASE_URL: 'postgresql://boosters:boosters@localhost:5432/boosters',
};

describe('loadEnv', () => {
  it('applies devnet/sandbox defaults', () => {
    const env = loadEnv(base as NodeJS.ProcessEnv);
    expect(env.SOLANA_CLUSTER).toBe('devnet');
    expect(env.PAYMENTS_MODE).toBe('sandbox');
    expect(env.ENABLE_MAINNET).toBe(false);
    expect(env.ENABLE_REAL_PAYMENTS).toBe(false);
  });

  it('throws on missing DATABASE_URL', () => {
    expect(() => loadEnv({} as NodeJS.ProcessEnv)).toThrow(/Invalid environment/);
  });
});

describe('safe-mode guardrail', () => {
  it('default config is safe mode', () => {
    const env = loadEnv(base as NodeJS.ProcessEnv);
    expect(isSafeMode(env)).toBe(true);
    expect(() => assertSafeMode(env)).not.toThrow();
  });

  it('rejects mainnet cluster without ENABLE_MAINNET', () => {
    const env = loadEnv({ ...base, SOLANA_CLUSTER: 'mainnet-beta' } as NodeJS.ProcessEnv);
    expect(() => assertSafeMode(env)).toThrow(/ENABLE_MAINNET=true/);
  });

  it('rejects ENABLE_MAINNET while still on devnet (inconsistent)', () => {
    const env = loadEnv({ ...base, ENABLE_MAINNET: 'true' } as NodeJS.ProcessEnv);
    expect(() => assertSafeMode(env)).toThrow(/inconsistent/);
  });

  it('rejects live payments without ENABLE_REAL_PAYMENTS', () => {
    const env = loadEnv({ ...base, PAYMENTS_MODE: 'live' } as NodeJS.ProcessEnv);
    expect(() => assertSafeMode(env)).toThrow(/ENABLE_REAL_PAYMENTS=true/);
  });

  it('accepts a fully-configured mainnet+live combo (post-audit shape)', () => {
    const env = loadEnv({
      ...base,
      SOLANA_CLUSTER: 'mainnet-beta',
      ENABLE_MAINNET: 'true',
      PAYMENTS_MODE: 'live',
      ENABLE_REAL_PAYMENTS: 'true',
    } as NodeJS.ProcessEnv);
    expect(() => assertSafeMode(env)).not.toThrow();
    expect(isSafeMode(env)).toBe(false);
  });
});
