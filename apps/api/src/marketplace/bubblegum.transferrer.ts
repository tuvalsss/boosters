import { Inject, Injectable, Logger } from '@nestjs/common';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { keypairIdentity, publicKey, type Umi } from '@metaplex-foundation/umi';
import { dasApi } from '@metaplex-foundation/digital-asset-standard-api';
import { getAssetWithProof, transfer } from '@metaplex-foundation/mpl-bubblegum';
import bs58 from 'bs58';
import type { Env } from '@boosters/config';
import { ENV } from '../config/config.module.js';
import type { CnftTransferrer, TransferParams } from './cnft-transferrer.js';

/**
 * Real Metaplex Bubblegum transfer. Signs as the configured authority, so it
 * can settle transfers of leaves the platform custodially owns (first-party
 * inventory). For leaves owned by a user wallet, server-side signing isn't
 * available here — it returns null and the DB ownership move is authoritative
 * until the user signs (delegated signing is a later integration).
 */
@Injectable()
export class BubblegumTransferrer implements CnftTransferrer {
  private readonly logger = new Logger(BubblegumTransferrer.name);
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

  async transfer(params: TransferParams): Promise<{ signature: string } | null> {
    if (!this.isConfigured) return null;
    const umi = this.getUmi();

    // We can only sign for leaves the authority currently owns.
    if (params.fromWallet !== this.authorityWallet) {
      this.logger.warn(
        `On-chain transfer of ${params.assetId} deferred: leaf owned by ${params.fromWallet}, not the server authority`,
      );
      return null;
    }

    const assetWithProof = await getAssetWithProof(umi, publicKey(params.assetId));
    const { signature } = await transfer(umi, {
      ...assetWithProof,
      leafOwner: publicKey(params.fromWallet),
      newLeafOwner: publicKey(params.toWallet),
    }).sendAndConfirm(umi);

    const sig = bs58.encode(signature);
    this.logger.log(`Transferred cNFT ${params.assetId} → ${params.toWallet} (sig ${sig})`);
    return { signature: sig };
  }
}
