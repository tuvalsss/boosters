import { Inject, Injectable, Logger } from '@nestjs/common';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { keypairIdentity, publicKey, type Umi } from '@metaplex-foundation/umi';
import { dasApi } from '@metaplex-foundation/digital-asset-standard-api';
import { burn, getAssetWithProof } from '@metaplex-foundation/mpl-bubblegum';
import bs58 from 'bs58';
import type { Env } from '@boosters/config';
import { ENV } from '../config/config.module.js';
import type { BurnParams, CnftBurner } from './cnft-burner.js';

/** Real Metaplex Bubblegum burn. Signs as the authority (custody-owned leaves). */
@Injectable()
export class BubblegumBurner implements CnftBurner {
  private readonly logger = new Logger(BubblegumBurner.name);
  private umi: Umi | null = null;
  private authorityWallet: string | null = null;

  constructor(@Inject(ENV) private readonly env: Env) {}

  get isConfigured(): boolean {
    return Boolean(
      this.env.MINT_AUTHORITY_SECRET && (this.env.HELIUS_RPC_URL || this.env.SOLANA_RPC_URL),
    );
  }

  private getUmi(): Umi {
    if (!this.umi) {
      const rpc = this.env.HELIUS_RPC_URL || this.env.SOLANA_RPC_URL;
      const umi = createUmi(rpc).use(dasApi());
      const secret = this.env.MINT_AUTHORITY_SECRET!.trim();
      const bytes = secret.startsWith('[')
        ? Uint8Array.from(JSON.parse(secret) as number[])
        : bs58.decode(secret);
      const keypair = umi.eddsa.createKeypairFromSecretKey(bytes);
      umi.use(keypairIdentity(keypair));
      this.authorityWallet = keypair.publicKey;
      this.umi = umi;
    }
    return this.umi;
  }

  async burn(params: BurnParams): Promise<{ signature: string } | null> {
    if (!this.isConfigured) return null;
    const umi = this.getUmi();
    if (params.ownerWallet !== this.authorityWallet) {
      this.logger.warn(`On-chain burn of ${params.assetId} deferred: leaf owned by the user`);
      return null;
    }
    const assetWithProof = await getAssetWithProof(umi, publicKey(params.assetId));
    const { signature } = await burn(umi, {
      ...assetWithProof,
      leafOwner: publicKey(params.ownerWallet),
    }).sendAndConfirm(umi);
    const sig = bs58.encode(signature);
    this.logger.log(`Burned cNFT ${params.assetId} (sig ${sig})`);
    return { signature: sig };
  }
}
