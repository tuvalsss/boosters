// Background-job queue names. Processors are implemented per-phase:
//   intake/minting (Phase 3), payouts (Phase 4/7), pack draws (Phase 6),
//   raffle draws + redeem shipping (Phase 8). Phase 1 only declares the names.

export const QUEUE_NAMES = {
  VAULT_INTAKE: 'vault-intake',
  CNFT_MINT: 'cnft-mint',
  CNFT_BURN: 'cnft-burn',
  PAYOUT: 'payout',
  PACK_DRAW: 'pack-draw',
  RAFFLE_DRAW: 'raffle-draw',
  FMV_REFRESH: 'fmv-refresh',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
