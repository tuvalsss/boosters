/**
 * Abstraction over compressed-NFT burning (redeem/claim). Burning is the
 * irreversible end of the custody gate: once burned, the token can never be
 * re-listed. DB state is authoritative; the on-chain burn is reflected when a
 * server-side signer for the leaf owner is available.
 */

export const CNFT_BURNER = Symbol('CNFT_BURNER');

export interface BurnParams {
  assetId: string;
  ownerWallet: string;
}

export interface CnftBurner {
  readonly isConfigured: boolean;
  /** Returns the burn signature, or null if it must be settled out-of-band. */
  burn(params: BurnParams): Promise<{ signature: string } | null>;
}
