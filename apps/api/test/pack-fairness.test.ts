// Pure (no DB) tests for the provably-fair draw — deterministic + reproducible.

import { describe, expect, it } from 'vitest';
import {
  commitmentHash,
  deriveFloat,
  draw,
  verify,
  type PoolCandidate,
} from '../src/packs/pack-fairness.js';

const candidates: PoolCandidate[] = [
  { poolItemId: 'a', vaultItemId: 'va', weight: 1 },
  { poolItemId: 'b', vaultItemId: 'vb', weight: 1 },
  { poolItemId: 'c', vaultItemId: 'vc', weight: 1 },
];

describe('commit-reveal primitives', () => {
  it('commitment hash is deterministic sha256', () => {
    expect(commitmentHash('abc')).toBe(commitmentHash('abc'));
    expect(commitmentHash('abc')).toHaveLength(64);
  });

  it('float is deterministic and within [0,1)', () => {
    const a = deriveFloat('server', 'client', 0);
    const b = deriveFloat('server', 'client', 0);
    expect(a.float).toBe(b.float);
    expect(a.float).toBeGreaterThanOrEqual(0);
    expect(a.float).toBeLessThan(1);
    // Changing any input changes the float.
    expect(deriveFloat('server', 'client', 1).float).not.toBe(a.float);
  });
});

describe('draw + verify', () => {
  it('is reproducible for the same inputs', () => {
    const r1 = draw('seed', 'client', 0, candidates);
    const r2 = draw('seed', 'client', 0, candidates);
    expect(r1.winner.vaultItemId).toBe(r2.winner.vaultItemId);
    expect(r1.index).toBe(r2.index);
  });

  it('verify() accepts a correct reveal and rejects tampering', () => {
    const serverSeed = 'super-secret-seed';
    const serverSeedHash = commitmentHash(serverSeed);
    const result = draw(serverSeed, 'mine', 7, candidates);

    const good = verify({
      serverSeed,
      serverSeedHash,
      clientSeed: 'mine',
      nonce: 7,
      candidates,
      expectedVaultItemId: result.winner.vaultItemId,
    });
    expect(good.ok).toBe(true);

    // Wrong commitment hash.
    expect(
      verify({
        serverSeed,
        serverSeedHash: commitmentHash('different'),
        clientSeed: 'mine',
        nonce: 7,
        candidates,
        expectedVaultItemId: result.winner.vaultItemId,
      }).ok,
    ).toBe(false);

    // Tampered expected winner.
    expect(
      verify({
        serverSeed,
        serverSeedHash,
        clientSeed: 'mine',
        nonce: 7,
        candidates,
        expectedVaultItemId: 'vWRONG',
      }).ok,
    ).toBe(false);
  });

  it('respects weights (heavy candidate wins ~proportionally)', () => {
    const weighted: PoolCandidate[] = [
      { poolItemId: 'rare', vaultItemId: 'vr', weight: 1 },
      { poolItemId: 'common', vaultItemId: 'vc', weight: 99 },
    ];
    let common = 0;
    const N = 2000;
    for (let i = 0; i < N; i++) {
      if (draw('seed', 'c', i, weighted).winner.vaultItemId === 'vc') common++;
    }
    const pct = common / N;
    expect(pct).toBeGreaterThan(0.9);
  });
});
