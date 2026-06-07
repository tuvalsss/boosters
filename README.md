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
- **Blockchain:** Solana, Metaplex Bubblegum cNFTs (live), Helius DAS reads _(Phase 4)._
- **Auth/wallets:** Privy (real) — email/Google/Apple + embedded & external Solana wallets.
- **Payments:** Coinflow sandbox _(Phase 10)._ **Randomness:** Solana VRF + commit-reveal _(Phase 6)._

## Environment — one file

All configuration lives in a **single root `.env`** (copy from `.env.example`).
`bootstrapEnv()` loads it for the api/worker and `next.config.mjs` loads it for
the web app — there are no per-app env files. To enable auth, create a Privy app
and set `PRIVY_APP_ID`, `PRIVY_APP_SECRET`, `NEXT_PUBLIC_PRIVY_APP_ID`, and list
your email in `ADMIN_BOOTSTRAP_EMAILS` to be granted ADMIN on first login.

## Auth, RBAC & admin (real)

- **Login:** real Privy (email / Google / Apple / external wallet) with embedded
  Solana wallets created for users without one.
- **Sessions:** the API verifies the Privy access token on every request
  (global `PrivyAuthGuard`), provisions a durable DB `User` on first login, and
  attaches it to the request. No mock users, no fake tokens.
- **RBAC:** `USER` / `OPS` / `ADMIN` roles enforced by a global `RolesGuard` +
  `@Roles()` decorator. New accounts start on a `NEW_ACCOUNT` hold (anti-fraud).
- **Admin panel** (`/admin`): staff-only console to search users and change
  roles (ADMIN), KYC status and account holds (ADMIN/OPS). Every mutation is
  written to the append-only audit log.
- **KYC:** real status machine. The devnet `manual` provider sets `PENDING` and
  waits for an ops decision — it never auto-approves. `veriff`/`sumsub` are gated
  behind `ENABLE_REAL_KYC` (Phase 10).
- **Account** (`/account`): profile + wallet + KYC self-service.

## Vault & minting (real, custody gate)

The vault is the heart of the custody gate (spec §3). A tradeable cNFT is minted
**only** at the internal `GRADED → VAULTED` transition — never from a user
assertion or photo upload.

- **State machine:** `INTAKE → AUTHENTICATING → GRADED → VAULTED → RESERVED →
RELEASED`, with illegal transitions rejected and every step audited.
- **Admin console** (`/admin/vault`): staff intake physical cards, start
  authentication, enter the grade, then **Vault & mint**. The intake queue is
  filterable by state.
- **Minting:** real Metaplex **Bubblegum** compressed NFTs via Umi
  (`BubblegumMinter`). Mints to the owner's Solana wallet; records the DAS asset
  id, merkle tree, leaf index and signature. Idempotent — never double-mints
  (guarded in code + by unique constraints).
- **Token metadata:** served as real Metaplex-standard JSON from
  `GET /api/metadata/vault/:id` (self-hosted; Arweave/IPFS is a Phase-10 polish).
- **Setup:** fund a devnet keypair, set `MINT_AUTHORITY_SECRET`, run
  `node scripts/create-merkle-tree.mjs`, paste the printed `MERKLE_TREE_ADDRESS`
  into `.env`. Until configured, vaulting fails with a clear error (no fake mint).

## Marketplace & ledger (real money path)

- **Double-entry ledger** is the authoritative money record. Every order's lines
  must net to zero — enforced at COMMIT by the deferred `LedgerEntry_balanced`
  trigger, so a mis-posted payment can never persist.
- **Custodial USDC balances**: a user's balance = credits − debits on their
  `USER_WALLET` rows. Devnet on-ramp via staff **Credit USDC** (admin panel);
  real Coinflow on-ramp is Phase 10.
- **Listings** (`/marketplace`): browse/filter/search active listings (public);
  list an item you own (custody gate — VAULTED + active token only; one active
  listing per item enforced by a DB partial unique index).
- **Buy**: atomic order + ledger (2% fee split: buyer −price, seller +98%,
  treasury fee), beneficial-ownership move, listing closed. **Idempotent** on a
  caller key — retries never double-charge. cNFT ownership is reflected on-chain
  via a guarded Bubblegum transferrer when a server-side signer is available;
  otherwise DB ownership is authoritative and settlement is recorded as deferred.
- **Portfolio** (`/portfolio`): USDC balance, holdings (with one-tap **List for
  sale**), and order history.

## Submit / consignment (real)

Users can ship in their own graded cards and get a 1:1 token minted to their
wallet (spec §6). Reuses the vault state machine and writes a `SubmissionEvent`
at every step so the user sees a full status timeline.

- **User** (`/submit`): declare a card → generate prepaid-shipping instructions
  - reference code → add tracking → watch the timeline. Cancel allowed until the
    card is in processing.
- **Ops** (`/admin/submissions`): receive (confirm the actual card, creates a
  vault item owned by the **submitter**) → authenticate → grade → photograph →
  **mint to the user** → tradeable. Reject with a reason at any point.
- Once minted, the consigned token is immediately listable (P2P) on the
  marketplace.

## Provably-fair packs (real)

Pack opening is verifiable by anyone (spec §6):

- **Commit → reveal**: opening a pack fixes + hashes a server seed
  (`sha256(serverSeed)` published) and charges USDC; reveal draws with the
  committed seed + a client seed and **reveals the server seed**.
- **Deterministic draw**: `float = HMAC_SHA256(serverSeed, "clientSeed:nonce")`
  → weighted selection over the ordered candidate pool. The full reproducible
  proof (algorithm, candidates+weights, entropy, index) is stored on the opening.
- **Public verification** (`/verify/[id]`): recomputes the draw in-browser with
  the Web Crypto API and checks `sha256(serverSeed)` against the commitment and
  the recomputed winner against the recorded result.
- **Transparent odds**: each pack page shows the live pool and per-card odds.
- **Admin** (`/admin/packs`): create packs, add vaulted cards to the pool,
  activate. The won card's ownership moves to the user on reveal (on-chain
  reflected when signable).

## Buyback (real, treasury-guarded)

Instant sell-back to the vault at a configurable % of FMV (spec §6, §9):

- **Quote**: `FMV × BUYBACK_DEFAULT_PERCENT_BPS` (default 87.5%), time-boxed
  (10 min), explicitly **non-guaranteed**.
- **Accept**: pays the user in USDC and returns the token to the custodial
  treasury (re-listable as first-party). Double-entry ledgered.
- **Hard guard (spec §9)**: a payout is refused if it would drain the treasury
  below `BUYBACK_FLOAT_FLOOR_USDC`. Unit + integration tested.
- **Pause flag**: admins can pause buyback at runtime (`Setting` table) — no
  redeploy.
- **Admin treasury panel** (`/admin/treasury`): balance, floor, available-for-
  buyback, pause toggle, devnet treasury funding, and FMV entry.
- **Portfolio**: a "Sell to vault" action quotes + accepts inline.

## Raffles & redeem (real)

- **Raffles** (`/raffles`): an owner lists a vaulted card (item goes RESERVED) →
  users buy tickets (paid into escrow) → on sellout a provably-fair draw picks
  the winner, transfers the card, and pays the seller proceeds (minus the 2%
  fee). Cancelling before the draw refunds every ticket and releases the item.
- **Redeem / claim** (`/redeem`): burns the token (irreversible — a burned token
  can never be re-listed, enforced by the custody gate), releases the physical
  from the vault (`VAULTED → RELEASED`), and opens a `Redemption` shipping record
  the user can track. Ops fulfil + add tracking via `/admin/redemptions`.

## Anti-fraud layer (spec §7)

Beyond the custody gate (the primary defense), the platform layers:

- **Account holds**: new accounts start on a `NEW_ACCOUNT` hold; held accounts
  can't list/sell/raffle until ops clear them.
- **FMV price bounds**: listings priced beyond `LISTING_FMV_DEVIATION_BPS` from
  FMV are auto-**HELD** and surfaced in the admin **review queue**
  (`/admin/review`) for approve/reject.
- **KYC gating**: required to consign, and required to keep listing once lifetime
  sales pass `SELLER_KYC_VOLUME_USDC`.
- **Rate limits**: per-account daily caps on listings/submissions, backed by
  Redis (`RateLimitGuard`, fail-open on outage).
- **Reputation**: completed sales lift the seller's score.
- **Audit log**: every state transition + money path is recorded (no silent edits).

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
config + tests, plus the visual home/packs/nav shell and the asset pipeline.

**Phase 2 — Auth + wallets + RBAC + admin: complete.** Real Privy auth, global
auth + roles guards, DB-backed user provisioning, profile/account, admin/ops
console with audited role/KYC/hold changes, a real KYC status machine, and a
single consolidated `.env`. Integration-tested against Postgres.

**Phase 3 — Vault + cNFT minting: complete.** Vault state machine, admin
intake/grading console, real Bubblegum cNFT minting wired to `GRADED → VAULTED`,
self-hosted token metadata, and the custody gate enforced end-to-end
(DB-integration tested: happy path, illegal transitions, idempotent mint,
wallet/config preconditions).

**Gated until audit (not stubbed away — flag-protected):** mainnet and real
payments. **Per later phases:** on-chain USDC settlement, VRF, real
pack/raffle/buyback logic, token burn/redeem, real KYC providers. The worker
declares queues but registers no processors yet.

**Phase 4 — Marketplace: complete.** Double-entry ledger, custodial USDC
balances, first-party & P2P listings (gate-enforced), USDC buy with 2% fee split

- ownership move + idempotency, guarded on-chain settlement, and the
  marketplace/listing/portfolio screens. Money paths integration-tested.

**Phase 5 — Submit/consignment: complete.** Full declare → label → ship →
receive → authenticate → grade → photograph → mint-to-user lifecycle with a
user-visible status timeline and an ops processing queue. Lifecycle
integration-tested.

**Phase 6 — Provably-fair packs: complete.** Commit-reveal opening, deterministic
HMAC-weighted draw, USDC payment, ownership move, transparent odds, an in-browser
public verification page, and admin pack/pool management. Fairness unit-tested +
open lifecycle integration-tested.

**Phase 7 — Buyback: complete.** FMV quotes, time-boxed + non-guaranteed,
double-entry USDC payouts, token return to treasury, runtime pause flag, and the
treasury float-floor hard guard. Integration-tested (incl. the floor guard).

**Phase 8 — Raffles + redeem/claim: complete.** Raffles (reserve, ticket escrow,
provably-fair draw + proceeds/fee, full refunds on cancel) and redeem (burn →
release → shipping record + ops fulfilment). Integration-tested.

**Phase 9 — Anti-fraud + admin hardening: complete.** Account-hold gating,
FMV price-bound auto-hold + review queue, KYC-for-consignment + volume gating,
Redis rate limits, and reputation scoring. Integration + unit tested.

**Next:** Phase 10 — Payments (Coinflow sandbox on-ramp), real KYC providers
(flagged), Arweave metadata, and test-coverage polish.

## Build order

1. **Scaffold** ✅ · 2. **Auth + wallets** ✅ · 3. **Vault + cNFT minting** ✅ · 4. **Marketplace** ✅ · 5. **Submit/consignment** ✅ · 6. **Provably-fair packs** ✅ · 7. **Buyback** ✅ · 8. **Raffles + redeem** ✅ · 9. **Anti-fraud + admin** ✅ · 10. Payments + KYC + polish.
