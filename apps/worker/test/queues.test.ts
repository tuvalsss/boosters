import { describe, expect, it } from 'vitest';
import { QUEUE_NAMES } from '../src/queues.js';

describe('queue registry', () => {
  it('declares the core background queues', () => {
    expect(QUEUE_NAMES.VAULT_INTAKE).toBe('vault-intake');
    expect(QUEUE_NAMES.CNFT_MINT).toBe('cnft-mint');
    expect(QUEUE_NAMES.CNFT_BURN).toBe('cnft-burn');
    expect(Object.values(QUEUE_NAMES)).toHaveLength(7);
  });
});
