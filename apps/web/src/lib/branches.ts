// Branch catalog — the "ענפים" (categories) shown across the app. Each branch
// maps to a folder of swappable PNG assets under /public/assets (see its
// README). Real prices/odds/inventory come from the API in later phases; these
// values are devnet placeholders for the visual shell.

export type BranchKey = 'pokemon' | 'onepiece' | 'yugioh' | 'nfl' | 'nba' | 'tcg';

export interface Branch {
  key: BranchKey;
  name: string;
  /** Tailwind-friendly accent (used for glow/gradient behind the pack). */
  accent: string;
  /** Short marketing line (no "guaranteed"/gambling language — spec §9). */
  tagline: string;
  packImage: string;
  cardImages: [string, string];
  /** Placeholder devnet pack price in USDC. */
  priceUsdc: number;
}

export const BRANCHES: Branch[] = [
  {
    key: 'yugioh',
    name: 'Yu-Gi-Oh',
    accent: '#19e08a',
    tagline: 'Graded Yu-Gi-Oh pulls, vaulted 1:1.',
    packImage: '/assets/packs/yugioh.png',
    cardImages: ['/assets/cards/yugioh-1.png', '/assets/cards/yugioh-2.png'],
    priceUsdc: 49,
  },
  {
    key: 'pokemon',
    name: 'Pokémon',
    accent: '#3b82f6',
    tagline: 'Slabbed Pokémon, held in custody.',
    packImage: '/assets/packs/pokemon.png',
    cardImages: ['/assets/cards/pokemon-1.png', '/assets/cards/pokemon-2.png'],
    priceUsdc: 59,
  },
  {
    key: 'onepiece',
    name: 'One Piece',
    accent: '#f3892b',
    tagline: 'One Piece TCG, authenticated and vaulted.',
    packImage: '/assets/packs/onepiece.png',
    cardImages: ['/assets/cards/onepiece-1.png', '/assets/cards/onepiece-2.png'],
    priceUsdc: 39,
  },
  {
    key: 'nfl',
    name: 'NFL',
    accent: '#d7263d',
    tagline: 'Graded gridiron rookies and legends.',
    packImage: '/assets/packs/nfl.png',
    cardImages: ['/assets/cards/nfl-1.png', '/assets/cards/nfl-2.png'],
    priceUsdc: 45,
  },
  {
    key: 'nba',
    name: 'NBA',
    accent: '#e9772b',
    tagline: 'Hardwood icons, slabbed and vaulted.',
    packImage: '/assets/packs/nba.png',
    cardImages: ['/assets/cards/nba-1.png', '/assets/cards/nba-2.png'],
    priceUsdc: 45,
  },
  {
    key: 'tcg',
    name: 'TCG',
    accent: '#9b6dff',
    tagline: 'Curated trading-card grails.',
    packImage: '/assets/packs/tcg.png',
    cardImages: ['/assets/cards/tcg-1.png', '/assets/cards/tcg-2.png'],
    priceUsdc: 35,
  },
];

export function branchByKey(key: BranchKey): Branch {
  const branch = BRANCHES.find((b) => b.key === key);
  if (!branch) throw new Error(`Unknown branch: ${key}`);
  return branch;
}
