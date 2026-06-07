// One-off: create a Bubblegum Merkle tree on the configured Solana cluster and
// print its address. Paste the address into MERKLE_TREE_ADDRESS in .env.
//
// Requires a funded MINT_AUTHORITY_SECRET (devnet SOL). Run:
//   node scripts/create-merkle-tree.mjs
//
// maxDepth/maxBufferSize below give ~16k cNFT capacity; raise maxDepth for more.

import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as dotenvConfig } from 'dotenv';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { generateSigner, keypairIdentity } from '@metaplex-foundation/umi';
import { createTree, mplBubblegum } from '@metaplex-foundation/mpl-bubblegum';
import bs58 from 'bs58';

// Load the single root .env.
const here = dirname(fileURLToPath(import.meta.url));
let dir = here;
for (let i = 0; i < 8; i++) {
  if (existsSync(join(dir, 'pnpm-workspace.yaml'))) {
    dotenvConfig({ path: join(dir, '.env') });
    break;
  }
  dir = dirname(dir);
}

const rpc = process.env.SOLANA_RPC_URL ?? 'https://api.devnet.solana.com';
const secret = process.env.MINT_AUTHORITY_SECRET;
if (!secret) {
  console.error('MINT_AUTHORITY_SECRET is required (base58 secret key or JSON byte array).');
  process.exit(1);
}

function parseSecretKey(s) {
  const t = s.trim();
  return t.startsWith('[') ? Uint8Array.from(JSON.parse(t)) : bs58.decode(t);
}

const umi = createUmi(rpc).use(mplBubblegum());
umi.use(keypairIdentity(umi.eddsa.createKeypairFromSecretKey(parseSecretKey(secret))));

const merkleTree = generateSigner(umi);
console.log(`Creating Merkle tree on ${rpc} …`);
await (await createTree(umi, { merkleTree, maxDepth: 14, maxBufferSize: 64 })).sendAndConfirm(umi);

console.log('\nMerkle tree created:');
console.log(`  MERKLE_TREE_ADDRESS=${merkleTree.publicKey}`);
console.log('\nPaste that line into your .env.');
