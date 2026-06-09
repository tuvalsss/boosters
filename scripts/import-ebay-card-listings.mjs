import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
let dir = here;
let repoRoot = null;
for (let i = 0; i < 8; i++) {
  if (existsSync(join(dir, 'pnpm-workspace.yaml'))) {
    repoRoot = dir;
    loadRootEnv(join(repoRoot, '.env'));
    break;
  }
  dir = dirname(dir);
}
if (!repoRoot) throw new Error('Unable to locate monorepo root from importer script.');

const requireFromDb = createRequire(join(repoRoot, 'packages/db/package.json'));
const { PrismaClient } = requireFromDb('@prisma/client');

const args = parseArgs(process.argv.slice(2));
const limit = Number(args.limit ?? 100);
const dryRun = Boolean(args['dry-run']);

if (args.help || args.h) {
  console.log(`Usage: pnpm ebay:import-cards -- --limit 100 [--dry-run]

Required env:
  EBAY_CLIENT_ID
  EBAY_CLIENT_SECRET
  DATABASE_URL

Optional env:
  EBAY_ENV=production|sandbox
  EBAY_MARKETPLACE_ID=EBAY_US
  EBAY_BROWSE_SCOPE=https://api.ebay.com/oauth/api_scope`);
  process.exit(0);
}

const clientId = process.env.EBAY_CLIENT_ID;
const clientSecret = process.env.EBAY_CLIENT_SECRET;
const ebayEnv = process.env.EBAY_ENV === 'sandbox' ? 'sandbox' : 'production';
const marketplaceId = process.env.EBAY_MARKETPLACE_ID || 'EBAY_US';
const scope = process.env.EBAY_BROWSE_SCOPE || 'https://api.ebay.com/oauth/api_scope';

if (!clientId || !clientSecret) {
  fail('Missing EBAY_CLIENT_ID / EBAY_CLIENT_SECRET. Add them to the root .env first.');
}

if (!process.env.DATABASE_URL && !dryRun) {
  fail('Missing DATABASE_URL. Add it to the root .env or run with --dry-run.');
}

const roots =
  ebayEnv === 'sandbox'
    ? {
        identity: 'https://api.sandbox.ebay.com',
        browse: 'https://api.sandbox.ebay.com',
      }
    : {
        identity: 'https://api.ebay.com',
        browse: 'https://api.ebay.com',
      };

const SEARCHES = [
  'pokemon psa 10 card',
  'pokemon raw card',
  'pokemon bgs card',
  'charizard graded card',
  'pikachu graded card',
  'sports rookie psa card',
  'basketball rookie graded card',
  'football rookie graded card',
  'baseball rookie graded card',
  'magic the gathering graded card',
  'yugioh psa card',
  'one piece tcg graded card',
];

const prisma = dryRun ? null : new PrismaClient();

try {
  const token = await getAccessToken();
  const listings = await collectListings(token, limit);

  if (dryRun) {
    console.log(JSON.stringify(listings.slice(0, 10), null, 2));
    console.log(`Dry run found ${listings.length} unique listings.`);
  } else {
    let upserted = 0;
    for (const listing of listings) {
      await prisma.ebayCardListing.upsert({
        where: { ebayItemId: listing.ebayItemId },
        update: {
          title: listing.title,
          cardName: listing.cardName,
          category: listing.category,
          setName: listing.setName,
          grader: listing.grader,
          grade: listing.grade,
          year: listing.year,
          tier: listing.tier,
          condition: listing.condition,
          imageUrl: listing.imageUrl,
          itemWebUrl: listing.itemWebUrl,
          itemAffiliateWebUrl: listing.itemAffiliateWebUrl,
          priceValue: listing.priceValue,
          priceCurrency: listing.priceCurrency,
          buyingOptions: listing.buyingOptions,
          sellerUsername: listing.sellerUsername,
          sellerFeedbackPercentage: listing.sellerFeedbackPercentage,
          sourceQuery: listing.sourceQuery,
          sourcePayload: listing.sourcePayload,
          status: 'ACTIVE',
          lastSeenAt: new Date(),
        },
        create: listing,
      });
      upserted += 1;
    }
    console.log(`Imported ${upserted} eBay card listings into EbayCardListing.`);
  }
} finally {
  await prisma?.$disconnect();
}

async function getAccessToken() {
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    scope,
  });
  const response = await fetch(`${roots.identity}/identity/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  if (!response.ok) {
    throw new Error(`eBay OAuth failed ${response.status}: ${await response.text()}`);
  }
  const data = await response.json();
  if (!data.access_token) throw new Error('eBay OAuth response did not include access_token');
  return data.access_token;
}

async function collectListings(token, target) {
  const seen = new Map();
  let searchIndex = 0;

  while (seen.size < target && searchIndex < SEARCHES.length * 3) {
    const query = SEARCHES[searchIndex % SEARCHES.length];
    const offset = Math.floor(searchIndex / SEARCHES.length) * 50;
    searchIndex += 1;

    const url = new URL('/buy/browse/v1/item_summary/search', roots.browse);
    url.searchParams.set('q', query);
    url.searchParams.set('limit', '50');
    url.searchParams.set('offset', String(offset));
    if (offset === 50) url.searchParams.set('sort', '-price');
    if (offset >= 100) url.searchParams.set('sort', 'price');
    url.searchParams.set('filter', 'buyingOptions:{FIXED_PRICE},priceCurrency:USD');

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-EBAY-C-MARKETPLACE-ID': marketplaceId,
      },
    });
    if (!response.ok) {
      throw new Error(`eBay search failed ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    for (const item of data.itemSummaries ?? []) {
      const listing = normaliseItem(item, query);
      if (!listing || seen.has(listing.ebayItemId)) continue;
      seen.set(listing.ebayItemId, listing);
      if (seen.size >= target) break;
    }
  }

  return [...seen.values()].slice(0, target);
}

function normaliseItem(item, sourceQuery) {
  const imageUrl = item.image?.imageUrl || item.thumbnailImages?.[0]?.imageUrl;
  const priceValue = Number(item.price?.value);
  if (!item.itemId || !item.title || !imageUrl || !Number.isFinite(priceValue)) return null;

  const title = item.title.trim();
  const parsed = parseTitle(title);
  return {
    ebayItemId: item.itemId,
    title,
    cardName: parsed.cardName,
    category: parsed.category,
    setName: parsed.setName,
    grader: parsed.grader,
    grade: parsed.grade,
    year: parsed.year,
    tier: tierFor(priceValue, title),
    condition: item.condition ?? null,
    imageUrl,
    itemWebUrl: item.itemWebUrl,
    itemAffiliateWebUrl: item.itemAffiliateWebUrl ?? null,
    priceValue: priceValue.toFixed(6),
    priceCurrency: item.price?.currency || 'USD',
    buyingOptions: item.buyingOptions ?? [],
    sellerUsername: item.seller?.username ?? null,
    sellerFeedbackPercentage: item.seller?.feedbackPercentage
      ? String(item.seller.feedbackPercentage)
      : null,
    sourceQuery,
    sourcePayload: item,
    status: 'ACTIVE',
    lastSeenAt: new Date(),
  };
}

function parseTitle(title) {
  const lower = title.toLowerCase();
  const yearMatch = title.match(/\b(19[8-9]\d|20[0-3]\d)\b/);
  const grader = lower.includes('psa')
    ? 'PSA'
    : lower.includes('bgs') || lower.includes('beckett')
      ? 'BGS'
      : lower.includes('cgc')
        ? 'CGC'
        : lower.includes('sgc')
          ? 'SGC'
          : 'RAW';
  const gradeMatch = title.match(/\b(?:PSA|BGS|CGC|SGC)?\s*(10|9\.5|9|8\.5|8|7\.5|7)\b/i);
  const category =
    lower.includes('pokemon') || lower.includes('charizard') || lower.includes('pikachu')
      ? 'POKEMON'
      : lower.includes('rookie') ||
          lower.includes('basketball') ||
          lower.includes('football') ||
          lower.includes('baseball') ||
          lower.includes('soccer') ||
          lower.includes('nba') ||
          lower.includes('nfl') ||
          lower.includes('mlb')
        ? 'SPORTS'
        : lower.includes('magic') ||
            lower.includes('mtg') ||
            lower.includes('yugioh') ||
            lower.includes('yu-gi-oh') ||
            lower.includes('tcg') ||
            lower.includes('one piece')
          ? 'TCG'
          : 'OTHER';

  const cleaned = title
    .replace(/\bPSA|BGS|CGC|SGC|Beckett|Gem Mint|Mint|Holo|Foil|Graded\b/gi, '')
    .replace(/\b10|9\.5|9|8\.5|8|7\.5|7\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    cardName: cleaned.slice(0, 160) || title.slice(0, 160),
    category,
    grader,
    grade: gradeMatch ? gradeMatch[1] : null,
    year: yearMatch ? Number(yearMatch[1]) : null,
    setName: inferSetName(title),
  };
}

function inferSetName(title) {
  const setMatch = title.match(
    /\b(?:Topps|Panini|Prizm|Select|Bowman|Upper Deck|Chrome|Base Set|Evolving Skies|Obsidian Flames|151)\b[^,-]*/i,
  );
  return setMatch ? setMatch[0].trim().slice(0, 120) : null;
}

function tierFor(price, title) {
  const lower = title.toLowerCase();
  if (price >= 750 || lower.includes('grail') || lower.includes('1/1')) return 'grail';
  if (price >= 250 || lower.includes('chase')) return 'chase';
  if (price >= 75 || lower.includes('rare')) return 'rare';
  if (price >= 25) return 'uncommon';
  return 'common';
}

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      parsed[key] = true;
    } else {
      parsed[key] = next;
      i += 1;
    }
  }
  return parsed;
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

function fail(message) {
  console.error(message);
  process.exit(1);
}
