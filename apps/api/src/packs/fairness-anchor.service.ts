import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import bs58 from 'bs58';
import type { Env } from '@boosters/config';
import { ENV } from '../config/config.module.js';

const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
const MAX_MEMO_BYTES = 566;

export interface CommitAnchorInput {
  openingId: string;
  packId: string;
  userId: string;
  serverSeedHash: string;
  clientSeed: string;
}

export interface RevealAnchorInput extends CommitAnchorInput {
  serverSeed: string;
  resultVaultItemId: string;
  floatHex: string;
  algorithm: string;
}

@Injectable()
export class FairnessAnchorService {
  private readonly logger = new Logger(FairnessAnchorService.name);
  private connection: Connection | null = null;
  private payer: Keypair | null = null;

  constructor(@Inject(ENV) private readonly env: Env) {}

  get isConfigured(): boolean {
    return Boolean(this.env.FAIRNESS_ANCHOR_ENABLED && this.env.FAIRNESS_ANCHOR_SECRET);
  }

  async anchorCommit(input: CommitAnchorInput): Promise<string | null> {
    return this.anchor({
      v: 1,
      app: 'boosters',
      event: 'pack.commit',
      openingId: input.openingId,
      packId: input.packId,
      serverSeedHash: input.serverSeedHash,
      clientSeed: input.clientSeed,
    });
  }

  async anchorReveal(input: RevealAnchorInput): Promise<string | null> {
    return this.anchor({
      v: 1,
      app: 'boosters',
      event: 'pack.reveal',
      openingId: input.openingId,
      packId: input.packId,
      serverSeedHash: input.serverSeedHash,
      serverSeed: input.serverSeed,
      winner: input.resultVaultItemId,
      floatHex: input.floatHex,
      algorithm: input.algorithm,
    });
  }

  private async anchor(payload: Record<string, string | number>): Promise<string | null> {
    if (!this.env.FAIRNESS_ANCHOR_ENABLED) return null;
    if (!this.env.FAIRNESS_ANCHOR_SECRET) {
      if (this.env.FAIRNESS_ANCHOR_REQUIRED) {
        throw new Error('Solana fairness anchoring is required: set FAIRNESS_ANCHOR_SECRET');
      }
      return null;
    }

    const memo = JSON.stringify(payload);
    const memoBytes = Buffer.byteLength(memo, 'utf8');
    if (memoBytes > MAX_MEMO_BYTES) {
      throw new Error(`Solana fairness memo is ${memoBytes} bytes; max is ${MAX_MEMO_BYTES}`);
    }

    try {
      const connection = this.getConnection();
      const payer = this.getPayer();
      const tx = new Transaction().add(
        new TransactionInstruction({
          programId: MEMO_PROGRAM_ID,
          keys: [{ pubkey: payer.publicKey, isSigner: true, isWritable: false }],
          data: Buffer.from(memo, 'utf8'),
        }),
      );
      tx.feePayer = payer.publicKey;
      return await sendAndConfirmTransaction(connection, tx, [payer], { commitment: 'confirmed' });
    } catch (err) {
      if (this.env.FAIRNESS_ANCHOR_REQUIRED) throw err;
      this.logger.warn(`Solana fairness anchor skipped: ${(err as Error).message}`);
      return null;
    }
  }

  private getConnection(): Connection {
    if (!this.connection) {
      this.connection = new Connection(this.env.HELIUS_RPC_URL || this.env.SOLANA_RPC_URL, {
        commitment: 'confirmed',
      });
    }
    return this.connection;
  }

  private getPayer(): Keypair {
    if (!this.payer) {
      this.payer = Keypair.fromSecretKey(parseSecretKey(this.env.FAIRNESS_ANCHOR_SECRET!));
    }
    return this.payer;
  }
}

function parseSecretKey(secret: string): Uint8Array {
  const trimmed = secret.trim();
  if (trimmed.startsWith('[')) {
    return Uint8Array.from(JSON.parse(trimmed) as number[]);
  }
  return bs58.decode(trimmed);
}
