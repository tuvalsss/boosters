import type { ListingRow } from './types';

export const SAMPLE_MARKETPLACE_LISTINGS: ListingRow[] = [
  sampleListing({
    id: 'sample-market-charizard-ex-349-psa10',
    cardName: 'Charizard ex 349/190',
    category: 'POKEMON',
    grader: 'PSA',
    grade: '10',
    setName: 'SV4a: Shiny Treasure ex',
    priceUsdc: '600.00',
    imageUrl: '/assets/sample-prizes/charizard-ex-psa10.svg',
    seller: 'Boosters vault',
  }),
  sampleListing({
    id: 'sample-market-pikachu-vmax-psa10',
    cardName: 'Pikachu VMAX 279/184',
    category: 'POKEMON',
    grader: 'PSA',
    grade: '10',
    setName: 'VMAX Climax',
    priceUsdc: '320.00',
    imageUrl: '/assets/sample-prizes/pikachu-vmax-psa10.svg',
    seller: 'Boosters vault',
  }),
  sampleListing({
    id: 'sample-market-umbreon-vmax-psa10',
    cardName: 'Umbreon VMAX 245/184',
    category: 'POKEMON',
    grader: 'PSA',
    grade: '10',
    setName: 'Eevee Heroes',
    priceUsdc: '950.00',
    imageUrl: '/assets/sample-prizes/umbreon-vmax-psa10.svg',
    seller: 'Boosters vault',
  }),
  sampleListing({
    id: 'sample-market-mewtwo-gx-psa10',
    cardName: 'Mewtwo GX 082/072',
    category: 'POKEMON',
    grader: 'PSA',
    grade: '10',
    setName: 'Shining Legends',
    priceUsdc: '410.00',
    imageUrl: '/assets/sample-prizes/mewtwo-gx-psa10.svg',
    seller: 'Boosters vault',
  }),
  sampleListing({
    id: 'sample-market-rookie-prizm-psa10',
    cardName: 'Rookie Silver Prizm',
    category: 'SPORTS',
    grader: 'PSA',
    grade: '10',
    setName: 'Silver Prizm',
    priceUsdc: '1200.00',
    imageUrl: '/assets/sample-prizes/rookie-prizm-psa10.svg',
    seller: 'Boosters vault',
  }),
  sampleListing({
    id: 'sample-market-arcana-dragon-bgs95',
    cardName: 'Arcana Dragon Foil',
    category: 'TCG',
    grader: 'BGS',
    grade: '9.5',
    setName: 'Vault Legends',
    priceUsdc: '250.00',
    imageUrl: '/assets/sample-prizes/arcana-dragon-bgs95.svg',
    seller: 'Boosters vault',
  }),
];

export function findSampleMarketplaceListing(id: string): ListingRow | null {
  return SAMPLE_MARKETPLACE_LISTINGS.find((listing) => listing.id === id) ?? null;
}

export function filterSampleMarketplaceListings(category: string, search: string): ListingRow[] {
  const query = search.trim().toLowerCase();
  return SAMPLE_MARKETPLACE_LISTINGS.filter((listing) => {
    const card = listing.vaultItem.physicalCard;
    const categoryMatches = !category || card.category === category;
    const searchMatches =
      !query ||
      [card.cardName, card.setName, card.grader, card.grade]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(query));
    return categoryMatches && searchMatches;
  });
}

function sampleListing(input: {
  id: string;
  cardName: string;
  category: string;
  grader: string;
  grade: string;
  setName: string;
  priceUsdc: string;
  imageUrl: string;
  seller: string;
}): ListingRow {
  return {
    id: input.id,
    priceUsdc: input.priceUsdc,
    type: 'FIRST_PARTY',
    status: 'ACTIVE',
    seller: { id: 'sample-seller-boosters', displayName: input.seller },
    vaultItem: {
      id: `${input.id}-vault-item`,
      token: { cnftAssetId: `${input.id}-preview-cnft` },
      physicalCard: {
        cardName: input.cardName,
        category: input.category,
        grader: input.grader,
        grade: input.grade,
        setName: input.setName,
        photos: [{ url: input.imageUrl, kind: 'front' }],
      },
    },
  };
}
