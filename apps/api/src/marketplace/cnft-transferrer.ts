/**
 * Abstraction over compressed-NFT ownership transfer. The authoritative record
 * of beneficial ownership is the database (Token.ownerId); this reflects a
 * transfer on-chain when a server-side signer for the current leaf owner is
 * available (first-party/custodial inventory). The only runtime implementation
 * is the real Bubblegum transferrer.
 */

export const CNFT_TRANSFERRER = Symbol('CNFT_TRANSFERRER');

export interface TransferParams {
  assetId: string;
  fromWallet: string;
  toWallet: string;
}

export interface CnftTransferrer {
  readonly isConfigured: boolean;
  /**
   * Reflect a transfer on-chain. Returns the signature, or `null` when the
   * transfer cannot be signed server-side (e.g. a user-owned leaf) and must be
   * settled out-of-band — the DB ownership move still stands.
   */
  transfer(params: TransferParams): Promise<{ signature: string } | null>;
}
