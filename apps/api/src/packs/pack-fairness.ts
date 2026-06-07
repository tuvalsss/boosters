// Provably-fair draw (spec §6). Deterministic and reproducible by anyone:
//   commitment = sha256(serverSeed)   (published BEFORE the client seed is set)
//   float      = HMAC_SHA256(serverSeed, `${clientSeed}:${nonce}`) → [0,1)
//   winner     = weighted selection over the (ordered) candidate pool
// After the draw the serverSeed is revealed; the public verification page
// recomputes these exact steps from the opening record. No mock, no hidden RNG.

import { createHash, createHmac } from 'node:crypto';

export const DRAW_ALGORITHM = 'hmac-sha256/v1';

export interface PoolCandidate {
  poolItemId: string;
  vaultItemId: string;
  weight: number;
}

export interface DrawResult {
  /** First 8 hex chars (32 bits) of the HMAC — the entropy used. */
  floatHex: string;
  float: number;
  index: number;
  winner: PoolCandidate;
}

export function commitmentHash(serverSeed: string): string {
  return createHash('sha256').update(serverSeed).digest('hex');
}

/** Map (serverSeed, clientSeed, nonce) to a float in [0, 1). */
export function deriveFloat(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
): {
  floatHex: string;
  float: number;
} {
  const digest = createHmac('sha256', serverSeed).update(`${clientSeed}:${nonce}`).digest('hex');
  const floatHex = digest.slice(0, 8);
  const float = parseInt(floatHex, 16) / 0x100000000;
  return { floatHex, float };
}

/** Weighted selection over an ordered candidate list (order matters for replay). */
export function selectWinner(candidates: PoolCandidate[], float: number): DrawResult {
  if (candidates.length === 0) throw new Error('Empty candidate pool');
  const total = candidates.reduce((s, c) => s + Math.max(c.weight, 0), 0);
  if (total <= 0) throw new Error('Total pool weight must be positive');

  const { floatHex, float: f } = { floatHex: '', float };
  let target = float * total;
  for (let i = 0; i < candidates.length; i++) {
    target -= Math.max(candidates[i]!.weight, 0);
    if (target < 0) {
      return { floatHex, float: f, index: i, winner: candidates[i]! };
    }
  }
  // Floating-point edge: fall back to the last candidate.
  const last = candidates.length - 1;
  return { floatHex, float: f, index: last, winner: candidates[last]! };
}

/** Full draw from seeds + ordered candidates. */
export function draw(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  candidates: PoolCandidate[],
): DrawResult {
  const { floatHex, float } = deriveFloat(serverSeed, clientSeed, nonce);
  const res = selectWinner(candidates, float);
  return { ...res, floatHex, float };
}

/** Verify a revealed opening reproduces the recorded winner. */
export function verify(params: {
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  candidates: PoolCandidate[];
  expectedVaultItemId: string;
}): { ok: boolean; reasons: string[]; result?: DrawResult } {
  const reasons: string[] = [];
  if (commitmentHash(params.serverSeed) !== params.serverSeedHash) {
    reasons.push('serverSeed does not match the published commitment hash');
  }
  let result: DrawResult | undefined;
  try {
    result = draw(params.serverSeed, params.clientSeed, params.nonce, params.candidates);
    if (result.winner.vaultItemId !== params.expectedVaultItemId) {
      reasons.push('recomputed winner does not match the recorded result');
    }
  } catch (e) {
    reasons.push((e as Error).message);
  }
  return { ok: reasons.length === 0, reasons, result };
}
