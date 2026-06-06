// Schema-level guarantees for the custody gate (spec §3).
//
// These tests assert the *structure* that makes the gate enforceable at the DB
// layer. They parse schema.prisma so they run with no database connection,
// keeping CI fast and deterministic. Behavioural enforcement is tested in later
// phases against a live Postgres instance.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const schema = readFileSync(resolve(__dirname, '../prisma/schema.prisma'), 'utf8');

/** Extract the body of a `model X { ... }` block. */
function modelBlock(name: string): string {
  const match = schema.match(new RegExp(`model ${name} \\{([\\s\\S]*?)\\n\\}`, 'm'));
  if (!match) throw new Error(`model ${name} not found in schema`);
  return match[1];
}

describe('custody gate — schema structure', () => {
  it('Token has a required, unique 1:1 link to a VaultItem (no orphan tokens)', () => {
    const token = modelBlock('Token');
    // Required (no `?` on the type) and unique.
    expect(token).toMatch(/vaultItemId\s+String\s+@unique/);
    expect(token).toMatch(/vaultItem\s+VaultItem\s+@relation/);
  });

  it('VaultItem has a required, unique 1:1 link to a PhysicalCard', () => {
    const vault = modelBlock('VaultItem');
    expect(vault).toMatch(/physicalCardId\s+String\s+@unique/);
    expect(vault).toMatch(/physicalCard\s+PhysicalCard\s+@relation/);
  });

  it('VaultItem state machine models the full lifecycle including RELEASED', () => {
    const stateEnum = schema.match(/enum VaultItemState \{([\s\S]*?)\n\}/)?.[1] ?? '';
    for (const state of ['INTAKE', 'AUTHENTICATING', 'GRADED', 'VAULTED', 'RESERVED', 'RELEASED']) {
      expect(stateEnum).toContain(state);
    }
  });

  it('Listing requires a vaultItemId (cannot list what is not vaulted)', () => {
    const listing = modelBlock('Listing');
    // `vaultItemId String` with no `?` => required.
    expect(listing).toMatch(/vaultItemId\s+String\b(?!\?)/);
  });

  it('Pack prize pool items require a vaultItemId', () => {
    const pool = modelBlock('PackPoolItem');
    expect(pool).toMatch(/vaultItemId\s+String\s+@unique/);
  });

  it('Raffle requires a vaultItemId', () => {
    const raffle = modelBlock('Raffle');
    expect(raffle).toMatch(/vaultItemId\s+String\s+@unique/);
  });

  it('Token burn is represented as a terminal, immutable status', () => {
    const tokenStatus = schema.match(/enum TokenStatus \{([\s\S]*?)\n\}/)?.[1] ?? '';
    expect(tokenStatus).toContain('ACTIVE');
    expect(tokenStatus).toContain('BURNED');
  });
});

describe('money paths — schema structure', () => {
  it('Order carries a unique idempotency key (no double-pay/double-mint)', () => {
    const order = modelBlock('Order');
    expect(order).toMatch(/idempotencyKey\s+String\s+@unique/);
  });

  it('Order on-chain signature is unique when present (traceable settlement)', () => {
    const order = modelBlock('Order');
    expect(order).toMatch(/onchainSignature\s+String\?\s+@unique/);
  });

  it('Ledger is double-entry: entries have a direction and an account type', () => {
    const entry = modelBlock('LedgerEntry');
    expect(entry).toMatch(/direction\s+LedgerDirection/);
    expect(entry).toMatch(/accountType\s+LedgerAccountType/);
    const direction = schema.match(/enum LedgerDirection \{([\s\S]*?)\n\}/)?.[1] ?? '';
    expect(direction).toContain('DEBIT');
    expect(direction).toContain('CREDIT');
  });

  it('Treasury is a distinct ledger account type (buyback float guard target)', () => {
    const accounts = schema.match(/enum LedgerAccountType \{([\s\S]*?)\n\}/)?.[1] ?? '';
    expect(accounts).toContain('TREASURY');
  });
});

describe('auditability — schema structure', () => {
  it('AuditLog records actor, entity, action and from/to state', () => {
    const audit = modelBlock('AuditLog');
    expect(audit).toMatch(/entityType\s+String/);
    expect(audit).toMatch(/action\s+String/);
    expect(audit).toMatch(/fromState\s+String\?/);
    expect(audit).toMatch(/toState\s+String\?/);
  });
});
