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
    update: {
      category: 'OTHER',
      grade: '10',
      setName: 'Boosters Originals',
      cardName: 'Gold Chase Prototype',
      year: 2026,
      attributes: { variant: 'Gold', language: 'EN', note: 'devnet seed' },
    },
    create: {
      category: 'OTHER',
      grader: 'PSA',
      certNumber: 'DEVNET-0001',
      grade: '10',
      setName: 'Boosters Originals',
      cardName: 'Gold Chase Prototype',
      year: 2026,
      attributes: { variant: 'Gold', language: 'EN', note: 'devnet seed' },
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

  await prisma.token.upsert({
    where: { vaultItemId: vaultItem.id },
    update: {},
    create: {
      vaultItemId: vaultItem.id,
      cnftAssetId: 'devnet-asset-0001',
      merkleTree: 'devnet-tree',
      leafIndex: 1,
      mintSignature: 'devnet-mint-signature-0001',
      ownerId: admin.id,
      status: 'ACTIVE',
    },
  });

  const pack =
    (await prisma.pack.findFirst({ where: { name: 'Boosters Rookie Pack' } })) ??
    (await prisma.pack.create({
      data: {
        name: 'Boosters Rookie Pack',
        description: 'Original Boosters pack with transparent odds and vault-backed cards.',
        priceUsdc: '35',
        brandLabel: 'BOOSTERS',
        coverImageUrl: '/assets/brand-packs/rookie.svg',
        accentColor: '#1fbf75',
        tier: 'CORE',
        oddsConfig: { weights: { common: 20, rare: 4, chase: 1 } },
        status: 'ACTIVE',
      },
    }));

  await prisma.pack.update({
    where: { id: pack.id },
    data: {
      description: 'Original Boosters pack with transparent odds and vault-backed cards.',
      coverImageUrl: '/assets/brand-packs/rookie.svg',
      accentColor: '#1fbf75',
      tier: 'CORE',
      status: 'ACTIVE',
    },
  });

  await prisma.packPoolItem.upsert({
    where: { vaultItemId: vaultItem.id },
    update: { packId: pack.id, tier: 'chase', consumed: false },
    create: { packId: pack.id, vaultItemId: vaultItem.id, tier: 'chase' },
  });

  // eslint-disable-next-line no-console
  console.log('Seeded devnet data:', {
    admin: admin.email,
    collector: collector.email,
    vaultItem: vaultItem.id,
    state: vaultItem.state,
    pack: pack.name,
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
