import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
let dir = here;
let repoRoot = null;
for (let i = 0; i < 8; i += 1) {
  if (existsSync(join(dir, 'pnpm-workspace.yaml'))) {
    repoRoot = dir;
    loadRootEnv(join(repoRoot, '.env'));
    break;
  }
  dir = dirname(dir);
}
if (!repoRoot) throw new Error('Unable to locate monorepo root from sample seed script.');

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`Usage: pnpm ebay:seed-samples

Seeds 6 temporary sample card listings into EbayCardListing.
Required env:
  DATABASE_URL`);
  process.exit(0);
}

if (!process.env.DATABASE_URL) {
  console.error('Missing DATABASE_URL. Add it to the root .env before seeding sample cards.');
  process.exit(1);
}

const requireFromDb = createRequire(join(repoRoot, 'packages/db/package.json'));
const { PrismaClient } = requireFromDb('@prisma/client');
const prisma = new PrismaClient();

const samples = [
  {
    ebayItemId: 'sample-charizard-ex-349-psa10',
    title: 'Charizard ex 349/190 - SV4a: Shiny Treasure ex - 2023 Pokemon Japanese - PSA 10',
    cardName: 'Charizard ex 349/190',
    category: 'POKEMON',
    setName: 'Shiny Treasure',
    grader: 'PSA',
    grade: '10',
    year: 2023,
    tier: 'grail',
    condition: 'Gem Mint (GM)',
    imageUrl: '/assets/sample-prizes/charizard-ex-psa10.svg',
    itemWebUrl: 'https://www.ebay.com/sch/i.html?_nkw=Charizard+ex+349%2F190+PSA+10',
    priceValue: '600.000000',
    priceCurrency: 'USD',
    sellerUsername: 'sample-seed',
  },
  {
    ebayItemId: 'sample-pikachu-vmax-psa10',
    title: 'Pikachu VMAX 279/184 - VMAX Climax - 2021 Pokemon Japanese - PSA 10',
    cardName: 'Pikachu VMAX 279/184',
    category: 'POKEMON',
    setName: 'VMAX Climax',
    grader: 'PSA',
    grade: '10',
    year: 2021,
    tier: 'chase',
    condition: 'Gem Mint (GM)',
    imageUrl: '/assets/sample-prizes/pikachu-vmax-psa10.svg',
    itemWebUrl: 'https://www.ebay.com/sch/i.html?_nkw=Pikachu+VMAX+279%2F184+PSA+10',
    priceValue: '320.000000',
    priceCurrency: 'USD',
    sellerUsername: 'sample-seed',
  },
  {
    ebayItemId: 'sample-umbreon-vmax-psa10',
    title: 'Umbreon VMAX 245/184 - Eevee Heroes - 2021 Pokemon Japanese - PSA 10',
    cardName: 'Umbreon VMAX 245/184',
    category: 'POKEMON',
    setName: 'Eevee Heroes',
    grader: 'PSA',
    grade: '10',
    year: 2021,
    tier: 'grail',
    condition: 'Gem Mint (GM)',
    imageUrl: '/assets/sample-prizes/umbreon-vmax-psa10.svg',
    itemWebUrl: 'https://www.ebay.com/sch/i.html?_nkw=Umbreon+VMAX+245%2F184+PSA+10',
    priceValue: '950.000000',
    priceCurrency: 'USD',
    sellerUsername: 'sample-seed',
  },
  {
    ebayItemId: 'sample-mewtwo-gx-psa10',
    title: 'Mewtwo GX 082/072 - Shining Legends - 2017 Pokemon Japanese - PSA 10',
    cardName: 'Mewtwo GX 082/072',
    category: 'POKEMON',
    setName: 'Shining Legends',
    grader: 'PSA',
    grade: '10',
    year: 2017,
    tier: 'rare',
    condition: 'Gem Mint (GM)',
    imageUrl: '/assets/sample-prizes/mewtwo-gx-psa10.svg',
    itemWebUrl: 'https://www.ebay.com/sch/i.html?_nkw=Mewtwo+GX+082%2F072+PSA+10',
    priceValue: '410.000000',
    priceCurrency: 'USD',
    sellerUsername: 'sample-seed',
  },
  {
    ebayItemId: 'sample-rookie-prizm-psa10',
    title: 'Rookie Silver Prizm - 2018 Basketball Prizm - PSA 10',
    cardName: 'Rookie Silver Prizm',
    category: 'SPORTS',
    setName: 'Silver Prizm',
    grader: 'PSA',
    grade: '10',
    year: 2018,
    tier: 'grail',
    condition: 'Gem Mint (GM)',
    imageUrl: '/assets/sample-prizes/rookie-prizm-psa10.svg',
    itemWebUrl: 'https://www.ebay.com/sch/i.html?_nkw=rookie+silver+prizm+PSA+10',
    priceValue: '1200.000000',
    priceCurrency: 'USD',
    sellerUsername: 'sample-seed',
  },
  {
    ebayItemId: 'sample-arcana-dragon-bgs95',
    title: 'Arcana Dragon Foil - Vault Legends - BGS 9.5',
    cardName: 'Arcana Dragon Foil',
    category: 'TCG',
    setName: 'Vault Legends',
    grader: 'BGS',
    grade: '9.5',
    year: 1999,
    tier: 'uncommon',
    condition: 'Gem Mint (GM)',
    imageUrl: '/assets/sample-prizes/arcana-dragon-bgs95.svg',
    itemWebUrl: 'https://www.ebay.com/sch/i.html?_nkw=fantasy+tcg+foil+graded+card',
    priceValue: '250.000000',
    priceCurrency: 'USD',
    sellerUsername: 'sample-seed',
  },
];

try {
  let upserted = 0;
  for (const sample of samples) {
    await prisma.ebayCardListing.upsert({
      where: { ebayItemId: sample.ebayItemId },
      update: {
        ...sample,
        buyingOptions: ['FIXED_PRICE'],
        sourceQuery: 'manual sample seed',
        sourcePayload: { manualSample: true },
        status: 'ACTIVE',
        lastSeenAt: new Date(),
      },
      create: {
        ...sample,
        buyingOptions: ['FIXED_PRICE'],
        sourceQuery: 'manual sample seed',
        sourcePayload: { manualSample: true },
        status: 'ACTIVE',
        lastSeenAt: new Date(),
      },
    });
    upserted += 1;
  }
  console.log(`Seeded ${upserted} sample card listings into EbayCardListing.`);
} finally {
  await prisma.$disconnect();
}

function loadRootEnv(path) {
  if (!existsSync(path)) return;
  for (const rawLine of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    const commentAt = value.indexOf(' #');
    if (commentAt >= 0) value = value.slice(0, commentAt).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
