# Boosters

A phygital trading-card platform. Physical graded collectible cards (Pokémon,
sports, TCG, …) are held in a custody vault and represented **1:1** as on-chain
tokens (compressed NFTs on Solana). Users buy, sell, trade, open packs, enter
raffles, consign their own cards, and redeem the physical card at any time.

> **Devnet / sandbox / test mode only.** No real funds, no real payments.
> Mainnet and real payments are gated behind explicit flags and only permitted
> after a smart-contract audit.

## The custody gate (central invariant)

A tradeable token exists **if and only if** it is backed by a real physical card
that is currently received, authenticated, graded, and held in the vault. This
is enforced across layers:

- **Schema:** `Token` has a required, unique 1:1 link to a `VaultItem`, which has
  a required, unique 1:1 link to a `PhysicalCard`. `Listing`, `PackPoolItem` and
  `Raffle` all require a `vaultItemId`.
- **Database:** a partial unique index allows at most one `ACTIVE` listing per
  vault item; a deferred constraint trigger enforces that every order's
  double-entry ledger nets to zero; ledger amounts must be positive.
- **App / smart-contract:** added in later phases (minting is triggered only by
  an internal "vault intake confirmed + graded" event).

See `packages/db/prisma/schema.prisma` and the `*_custody_gate_guards` migration.

## Tech stack

- **Frontend:** Next.js (App Router) + TypeScript + Tailwind, installable PWA, mobile-first.
- **Backend:** NestJS (Fastify) + PostgreSQL (Prisma) + Redis (BullMQ workers).
- **Blockchain:** Solana, Metaplex Bubblegum cNFTs, Helius DAS reads _(wired in Phase 3)._
- **Auth/wallets:** Privy _(Phase 2)._ **Payments:** Coinflow sandbox _(Phase 10)._
- **Randomness:** Solana VRF + commit-reveal _(Phase 6)._

## Monorepo layout

```
apps/
  web/      Next.js PWA (marketplace, packs, portfolio, admin)
  api/      NestJS API (Fastify) — config + health wired; feature modules per phase
  worker/   BullMQ background workers — queue registry declared; processors per phase
packages/
  db/       Prisma schema (domain model), client, migrations, seed
  config/   zod-validated env + devnet/mainnet safe-mode guardrails
  eslint-config/  shared flat ESLint config
  tsconfig/       shared TS configs
```

## Running on devnet

Prereqs: Node 20+, pnpm 9+, Docker (or a local Postgres 16 + Redis 7).

```bash
pnpm install
cp .env.example .env            # defaults are devnet/sandbox

# Infra (Postgres + Redis)
pnpm docker:up                  # or use your own Postgres/Redis

# Database
pnpm db:generate                # prisma client
pnpm db:migrate                 # apply migrations
pnpm db:seed                    # optional devnet demo data

# Dev servers
pnpm dev                        # turbo runs web (:3000), api (:4000), worker
```

Quality gates (all green): `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.
CI runs them on every PR (`.github/workflows/ci.yml`) against ephemeral
Postgres + Redis services.

### Safe-mode guardrail

`@boosters/config` refuses inconsistent configs: mainnet requires
`ENABLE_MAINNET=true`, live payments require `ENABLE_REAL_PAYMENTS=true`, etc.
`assertSafeMode()` runs at the boot of every service that can move funds or mint.

## Frontend shell

The web app ships a responsive shell modeled on the product references:

- **Home** (`/`) — "Rip packs. Pull graded cards." hero + an **Open Packs** grid.
- **Packs** (`/packs`) — a **visual pack shuffler**: a fanned 3-pack carousel with
  an accent glow, a `Shuffle` action that spins and settles on a pack, and
  tap-to-select. (Real provably-fair opening lands in Phase 6.)
- **Navigation** — a high-density **desktop sidebar rail** and a slide-in
  **mobile drawer** sharing one nav definition (Home, Packs, Pack Party,
  Marketplace, Leaderboard; Community; branch shortcuts).
- **Branch pages** (`/branch/[key]`) per category.

### Swappable image assets

Placeholder artwork lives in `apps/web/public/assets/` organized by branch
(`packs/<branch>.png`, `cards/<branch>-N.png`). **Drop a real PNG with the same
name to replace it** — no code change needed. Regenerate placeholders with
`node scripts/generate-placeholder-assets.mjs`. See the folder's README.

## Build status

**Phase 1 — Scaffold: complete.** Monorepo + Docker + Postgres/Prisma domain
model + migrations + Next.js PWA shell + NestJS/worker skeletons + CI + env
config + tests. Plus the visual home/packs/nav shell and the asset pipeline.

**Stubbed (by design, per phase):** auth/wallets, cNFT mint/burn, on-chain
settlement, payments, KYC, VRF, real pack/raffle/buyback logic. The worker
declares queues but registers no processors yet.

**Next:** Phase 2 — Privy auth + embedded Solana wallets + user/profile + KYC
status stub.

## Build order

1. **Scaffold** ✅ 2. Auth + wallets · 3. Vault + cNFT minting ·
   4. Marketplace · 5. Submit/consignment · 6. Provably-fair packs · 7. Buyback ·
   8. Raffles + redeem · 9. Anti-fraud + admin · 10. Payments + KYC + polish.
