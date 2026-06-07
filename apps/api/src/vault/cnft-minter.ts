/**
 * Abstraction over compressed-NFT minting so the vault state machine doesn't
 * depend on chain specifics, and so tests can drive the gate logic with a
 * deterministic minter. The ONLY runtime implementation is the real Bubblegum
 * minter (see bubblegum.minter.ts) — there is no mock wired into the system.
 */

export const CNFT_MINTER = Symbol('CNFT_MINTER');

export interface MintParams {
  /** Destination Solana wallet (the vault item owner). */
  ownerWallet: string;
  /** On-chain NFT name (<= 32 chars). */
  name: string;
  /** Publicly reachable metadata JSON URI. */
  metadataUri: string;
}

export interface MintResult {
  /** Helius/DAS asset id of the freshly minted cNFT. */
  assetId: string;
  merkleTree: string;
  leafIndex: number;
  signature: string;
}

export interface CnftMinter {
  /** Whether mint credentials + tree are configured. */
  readonly isConfigured: boolean;
  /** Mint a cNFT to `ownerWallet`. Throws if not configured or on chain error. */
  mint(params: MintParams): Promise<MintResult>;
}
