# Setup & handoff guide

Everything runs on **devnet / sandbox** out of the box. Fill in the keys below
to light up each integration. Nothing is mocked — features that need a key fail
with a clear message until the key is present.

## 1. Local quickstart

```bash
pnpm install
cp .env.example .env          # single source of truth for ALL apps
pnpm docker:up                # Postgres + Redis (or use your own)
pnpm db:generate && pnpm db:migrate
pnpm db:seed                  # optional demo data
pnpm dev                      # web :3000 · api :4000 · worker
```

Quality gates (all green): `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.

## 2. Keys to fill in `.env`

Grouped by what they unlock. Leave the rest as-is for devnet.

| Integration                        | Vars                                                                                        | Where to get them                                  |
| ---------------------------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| **Auth (Privy)** — login + wallets | `PRIVY_APP_ID`, `PRIVY_APP_SECRET`, `NEXT_PUBLIC_PRIVY_APP_ID`                              | dashboard.privy.io                                 |
| **Make yourself admin**            | `ADMIN_BOOTSTRAP_EMAILS=you@example.com`                                                    | your login email — ADMIN on first login            |
| **Minting (Bubblegum)**            | `MINT_AUTHORITY_SECRET`, `MERKLE_TREE_ADDRESS`                                              | a funded devnet keypair; tree via the script below |
| **On-chain reads/transfers**       | `HELIUS_API_KEY`, `HELIUS_RPC_URL`                                                          | helius.dev (DAS-enabled RPC)                       |
| **Payments (Coinflow)**            | `COINFLOW_MERCHANT_ID`, `COINFLOW_API_KEY`                                                  | coinflow.cash (sandbox first)                      |
| **KYC (real)**                     | `KYC_PROVIDER` (veriff/sumsub), `KYC_WEBHOOK_SECRET`, provider keys, `ENABLE_REAL_KYC=true` | veriff.com / sumsub.com                            |
| **Media**                          | `S3_*`                                                                                      | Cloudflare R2 / AWS S3                             |

### Provision the Merkle tree (once)

```bash
# After setting MINT_AUTHORITY_SECRET (funded devnet SOL):
node scripts/create-merkle-tree.mjs
# paste the printed MERKLE_TREE_ADDRESS=... into .env
```

### First run-through

1. Log in (becomes ADMIN via `ADMIN_BOOTSTRAP_EMAILS`).
2. **/admin/vault** → intake a card → authenticate → grade → **Vault & mint**.
3. **/admin** → "Credit USDC" to a user (or use **/payments** on-ramp).
4. List it on the marketplace, open packs, run a raffle, buy back, redeem.

## 3. Production stack (Docker)

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Brings up Postgres, Redis, runs migrations, then api (:4000), worker, web (:3000).
Build context is the repo root; the web image bakes `NEXT_PUBLIC_*` at build time,
so keep `.env` present when building.

## 4. Going live (after a security audit)

Real mainnet + real money are gated by **two independent flags each** so it can't
happen by accident (`assertSafeMode` enforces consistency at boot):

```env
SOLANA_CLUSTER=mainnet-beta
ENABLE_MAINNET=true
PAYMENTS_MODE=live
ENABLE_REAL_PAYMENTS=true
```

Do this only after a smart-contract / security audit. Until then everything is
devnet/sandbox and the treasury float floor, idempotency, and custody gate guard
every money/ownership path.

## 5. What each service does

- **web** — Next.js PWA (marketplace, packs, raffles, submit, portfolio, admin).
- **api** — NestJS: auth/RBAC, vault/minting, marketplace/ledger, packs, buyback,
  raffles, redeem, payments. Global auth + exception filter + security headers.
- **worker** — BullMQ: sweeps expired buyback quotes + abandoned on-ramps and
  alerts on a low treasury float.
