// Devnet seed data. SAFE: no real funds, no real cards — illustrative only.
// Demonstrates the custody gate: PhysicalCard -> VaultItem(VAULTED) -> Token.
//
// Run with: pnpm db:seed

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Ops/admin user (Privy wiring comes in Phase 2).
  const admin = await prisma.user.upsert({
    where: { email: 'ops@boosters.local' },
    update: {},
    create: {
      email: 'ops@boosters.local',
      displayName: 'Boosters Ops',
      role: 'ADMIN',
      kycStatus: 'APPROVED',
      hold: 'NONE',
    },
  });

  // A demo collector who "owns" a vaulted card.
  const collector = await prisma.user.upsert({
    where: { email: 'collector@boosters.local' },
    update: {},
    create: {
      email: 'collector@boosters.local',
      displayName: 'Demo Collector',
      role: 'USER',
      kycStatus: 'APPROVED',
      hold: 'NONE',
    },
  });

  // First-party graded card already in the vault.
  const card = await prisma.physicalCard.upsert({
    where: { grader_certNumber: { grader: 'PSA', certNumber: 'DEVNET-0001' } },
    update: {},
    create: {
      category: 'POKEMON',
      grader: 'PSA',
      certNumber: 'DEVNET-0001',
      grade: '10',
      setName: 'Base Set',
      cardName: 'Charizard (Holo)',
      year: 1999,
      attributes: { variant: 'Holo', language: 'EN', note: 'devnet seed' },
    },
  });

  const vaultItem = await prisma.vaultItem.upsert({
    where: { physicalCardId: card.id },
    update: {},
    create: {
      physicalCardId: card.id,
      ownerId: admin.id,
      state: 'VAULTED',
      vaultLocation: 'DEV-A1',
    },
  });

  await prisma.fmvSnapshot.create({
    data: {
      physicalCardId: card.id,
      vaultItemId: vaultItem.id,
      source: 'MANUAL',
      valueUsdc: '10000.000000',
    },
  });

  // eslint-disable-next-line no-console
  console.log('Seeded devnet data:', {
    admin: admin.email,
    collector: collector.email,
    vaultItem: vaultItem.id,
    state: vaultItem.state,
  });
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
