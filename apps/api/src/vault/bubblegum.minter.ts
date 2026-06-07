import { Inject, Injectable, Logger } from '@nestjs/common';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { keypairIdentity, publicKey, none, type Umi } from '@metaplex-foundation/umi';
import {
  mplBubblegum,
  mintV1,
  parseLeafFromMintV1Transaction,
} from '@metaplex-foundation/mpl-bubblegum';
import bs58 from 'bs58';
import type { Env } from '@boosters/config';
import { ENV } from '../config/config.module.js';
import type { CnftMinter, MintParams, MintResult } from './cnft-minter.js';

/**
 * Real Metaplex Bubblegum compressed-NFT minter on Solana. Lazily builds the
 * Umi client from env so the API boots without mint credentials; any mint then
 * fails loudly instead of faking a token.
 */
@Injectable()
export class BubblegumMinter implements CnftMinter {
  private readonly logger = new Logger(BubblegumMinter.name);
  private umi: Umi | null = null;

  constructor(@Inject(ENV) private readonly env: Env) {}

  get isConfigured(): boolean {
    return Boolean(this.env.MINT_AUTHORITY_SECRET && this.env.MERKLE_TREE_ADDRESS);
  }

  private getUmi(): Umi {
    if (!this.isConfigured) {
      throw new Error(
        'Minting is not configured: set MINT_AUTHORITY_SECRET and MERKLE_TREE_ADDRESS in .env',
      );
    }
    if (!this.umi) {
      const umi = createUmi(this.env.SOLANA_RPC_URL).use(mplBubblegum());
      const secret = parseSecretKey(this.env.MINT_AUTHORITY_SECRET!);
      const keypair = umi.eddsa.createKeypairFromSecretKey(secret);
      umi.use(keypairIdentity(keypair));
      this.umi = umi;
    }
    return this.umi;
  }

  async mint(params: MintParams): Promise<MintResult> {
    const umi = this.getUmi();
    const merkleTree = publicKey(this.env.MERKLE_TREE_ADDRESS!);

    const { signature } = await mintV1(umi, {
      leafOwner: publicKey(params.ownerWallet),
      merkleTree,
      metadata: {
        name: params.name.slice(0, 32),
        uri: params.metadataUri,
        sellerFeeBasisPoints: 0,
        collection: none(),
        creators: [],
      },
    }).sendAndConfirm(umi);

    // Derive the leaf (asset id + index) from the confirmed transaction.
    const leaf = await parseLeafFromMintV1Transaction(umi, signature);
    const sig = bs58.encode(signature);

    this.logger.log(`Minted cNFT ${leaf.id} to ${params.ownerWallet} (sig ${sig})`);
    return {
      assetId: leaf.id,
      merkleTree: this.env.MERKLE_TREE_ADDRESS!,
      leafIndex: Number(leaf.nonce),
      signature: sig,
    };
  }
}

/** Accept either a base58-encoded secret key or a JSON byte array. */
function parseSecretKey(secret: string): Uint8Array {
  const trimmed = secret.trim();
  if (trimmed.startsWith('[')) {
    return Uint8Array.from(JSON.parse(trimmed) as number[]);
  }
  return bs58.decode(trimmed);
}
