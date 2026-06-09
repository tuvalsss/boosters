// Centralised, validated runtime configuration for Boosters.
//
// Single source of truth: ONE `.env` at the repo root feeds every app
// (web, api, worker). `bootstrapEnv()` loads it, then `loadEnv()` validates.
//
// GUARDRAIL (spec §9): the platform runs on devnet/sandbox by default. Real
// mainnet and real payments are only permitted behind explicit flags AND only
// after a smart-contract audit. `assertSafeMode()` makes "accidentally live"
// impossible without setting two independent flags on purpose.

import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { config as dotenvConfig } from 'dotenv';
import { z } from 'zod';

const boolFromEnv = z
  .enum(['true', 'false'])
  .transform((v) => v === 'true')
  .or(z.boolean());

const intFromEnv = z.coerce.number().int();

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // Network / mode guardrails.
  SOLANA_CLUSTER: z.enum(['devnet', 'testnet', 'mainnet-beta']).default('devnet'),
  PAYMENTS_MODE: z.enum(['sandbox', 'live']).default('sandbox'),
  ENABLE_MAINNET: boolFromEnv.default(false),
  ENABLE_REAL_PAYMENTS: boolFromEnv.default(false),
  ENABLE_REAL_KYC: boolFromEnv.default(false),

  // Infra.
  DATABASE_URL: z.string().url().or(z.string().startsWith('postgresql://')),
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // API.
  API_PORT: intFromEnv.default(4000),
  API_HOST: z.string().default('0.0.0.0'),
  API_CORS_ORIGIN: z.string().default('http://localhost:3000'),

  // Solana / RPC.
  SOLANA_RPC_URL: z.string().default('https://api.devnet.solana.com'),
  HELIUS_API_KEY: z.string().optional(),
  HELIUS_RPC_URL: z.string().optional(),

  // Provably-fair pack openings. `commit-reveal` is the production baseline:
  // publish a server-seed hash before draw, reveal the seed after draw, and
  // optionally anchor both events on Solana via the Memo program. `switchboard`
  // is reserved for a future fully on-chain VRF settlement flow.
  RANDOMNESS_PROVIDER: z.enum(['commit-reveal', 'switchboard']).default('commit-reveal'),
  FAIRNESS_ANCHOR_ENABLED: boolFromEnv.default(true),
  FAIRNESS_ANCHOR_REQUIRED: boolFromEnv.default(false),
  // Fee-payer used only for Solana Memo proof transactions. Base58 secret key or
  // JSON byte array. Optional so local builds run without secrets.
  FAIRNESS_ANCHOR_SECRET: z.string().optional(),

  // Metaplex Bubblegum (cNFT mint). Required at runtime to vault/mint; optional
  // at schema level so non-minting work and tooling run without secrets.
  // MINT_AUTHORITY_SECRET: base58 secret key OR JSON array of bytes.
  MINT_AUTHORITY_SECRET: z.string().optional(),
  MERKLE_TREE_ADDRESS: z.string().optional(),

  // Publicly reachable base URL of the API (used to build token metadata URIs
  // that the cNFT points at). Defaults to the local API.
  PUBLIC_API_URL: z.string().default('http://localhost:4000'),

  // Auth: Privy. Required at runtime for auth to function; optional at the
  // schema level so build/typecheck/dev tooling work without secrets present.
  PRIVY_APP_ID: z.string().optional(),
  PRIVY_APP_SECRET: z.string().optional(),
  // Optional offline JWT verification key (ES256 public key, PEM).
  PRIVY_VERIFICATION_KEY: z.string().optional(),

  // Comma-separated emails auto-granted ADMIN on first login (bootstraps the
  // admin panel without a chicken-and-egg). Real accounts, not seeded mocks.
  ADMIN_BOOTSTRAP_EMAILS: z.string().default(''),

  // KYC provider. `manual` = real ops review via the admin panel (devnet
  // default). `veriff`/`sumsub` are gated behind ENABLE_REAL_KYC (Phase 10).
  KYC_PROVIDER: z.enum(['manual', 'veriff', 'sumsub']).default('manual'),
  // Shared secret used to verify inbound KYC provider webhooks (HMAC).
  KYC_WEBHOOK_SECRET: z.string().optional(),
  // Local/manual KYC document storage. Relative paths resolve from the API cwd.
  KYC_UPLOAD_DIR: z.string().default('uploads/kyc'),

  // Payments: Coinflow (USDC on-ramp). Sandbox by default; gated by
  // ENABLE_REAL_PAYMENTS for live. Webhooks are HMAC-verified with the API key.
  COINFLOW_MERCHANT_ID: z.string().optional(),
  COINFLOW_API_KEY: z.string().optional(),

  // Treasury / fees guardrails.
  BUYBACK_FLOAT_FLOOR_USDC: intFromEnv.default(1000),
  BUYBACK_DEFAULT_PERCENT_BPS: intFromEnv.default(8750),
  MARKETPLACE_FEE_BPS: intFromEnv.default(200),

  // Anti-fraud limits.
  LISTING_FMV_DEVIATION_BPS: intFromEnv.default(2500),
  // Lifetime sales (USDC) above which a seller must be KYC-approved to list.
  SELLER_KYC_VOLUME_USDC: intFromEnv.default(1000),
  RATE_LIMIT_LISTINGS_PER_DAY: intFromEnv.default(25),
  RATE_LIMIT_SUBMISSIONS_PER_DAY: intFromEnv.default(10),

  // eBay sourcing catalog. Uses the official Buy Browse API; credentials stay
  // server-side and are only needed for import/refresh jobs.
  EBAY_ENV: z.enum(['production', 'sandbox']).default('production'),
  EBAY_CLIENT_ID: z.string().optional(),
  EBAY_CLIENT_SECRET: z.string().optional(),
  EBAY_MARKETPLACE_ID: z.string().default('EBAY_US'),
  EBAY_BROWSE_SCOPE: z.string().default('https://api.ebay.com/oauth/api_scope'),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Parse + validate the given environment (defaults to process.env).
 * Throws a readable error listing every invalid/missing variable.
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}

/** Walk up from `start` to find the monorepo root (where pnpm-workspace.yaml lives). */
function findRepoRoot(start: string): string | null {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

/**
 * Load the single root `.env` (if present) into process.env, then validate.
 * Existing process.env values win, so real deployment env vars are never
 * overridden by a committed file. Call this once at the start of api/worker.
 */
export function bootstrapEnv(cwd: string = process.cwd()): Env {
  const root = findRepoRoot(cwd);
  if (root) dotenvConfig({ path: join(root, '.env') });
  return loadEnv();
}

/** Parse ADMIN_BOOTSTRAP_EMAILS into a normalised, deduped set. */
export function adminBootstrapEmails(env: Env): Set<string> {
  return new Set(
    env.ADMIN_BOOTSTRAP_EMAILS.split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

/**
 * Hard guardrail. Refuses to enable a "live" capability unless BOTH the cluster
 * and the corresponding flag are explicitly set. Call this at startup of any
 * service that can move funds or mint on-chain.
 *
 * @throws if the configuration is internally inconsistent (e.g. live payments
 *         requested while still pointed at devnet, or mainnet without its flag).
 */
export function assertSafeMode(env: Env): void {
  if (env.SOLANA_CLUSTER === 'mainnet-beta' && !env.ENABLE_MAINNET) {
    throw new Error('SOLANA_CLUSTER=mainnet-beta requires ENABLE_MAINNET=true (post-audit only).');
  }
  if (env.ENABLE_MAINNET && env.SOLANA_CLUSTER !== 'mainnet-beta') {
    throw new Error('ENABLE_MAINNET=true but SOLANA_CLUSTER is not mainnet-beta — inconsistent.');
  }
  if (env.PAYMENTS_MODE === 'live' && !env.ENABLE_REAL_PAYMENTS) {
    throw new Error('PAYMENTS_MODE=live requires ENABLE_REAL_PAYMENTS=true (post-audit only).');
  }
  if (env.ENABLE_REAL_PAYMENTS && env.PAYMENTS_MODE !== 'live') {
    throw new Error('ENABLE_REAL_PAYMENTS=true but PAYMENTS_MODE is not live — inconsistent.');
  }
}

/** True when the process is running fully in safe (devnet + sandbox) mode. */
export function isSafeMode(env: Env): boolean {
  return (
    env.SOLANA_CLUSTER !== 'mainnet-beta' &&
    !env.ENABLE_MAINNET &&
    env.PAYMENTS_MODE === 'sandbox' &&
    !env.ENABLE_REAL_PAYMENTS
  );
}
