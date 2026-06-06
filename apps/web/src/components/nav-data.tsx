import type { ComponentType, SVGProps } from 'react';
import {
  BagIcon,
  ClockIcon,
  GiftIcon,
  HomeIcon,
  LayersIcon,
  PartyIcon,
  SparkleIcon,
  TrophyIcon,
} from './icons';

export interface NavItem {
  label: string;
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  badge?: string;
}

export interface NavSection {
  /** Section heading; omitted for the primary block. */
  title?: string;
  items: NavItem[];
}

// Mirrors the reference mobile menu; reused for the desktop sidebar.
export const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { label: 'Home', href: '/', icon: HomeIcon },
      { label: 'Packs', href: '/packs', icon: LayersIcon, badge: 'NEW' },
      { label: 'Pack Party', href: '/pack-party', icon: PartyIcon },
      { label: 'Marketplace', href: '/marketplace', icon: BagIcon },
      { label: 'Leaderboard', href: '/leaderboard', icon: TrophyIcon },
    ],
  },
  {
    title: 'Community',
    items: [
      { label: 'Activity', href: '/activity', icon: ClockIcon },
      { label: 'Refer & Earn', href: '/refer', icon: GiftIcon },
    ],
  },
  {
    title: 'More',
    items: [
      { label: 'Pokémon', href: '/branch/pokemon', icon: SparkleIcon },
      { label: 'One Piece', href: '/branch/onepiece', icon: SparkleIcon },
      { label: 'Yu-Gi-Oh', href: '/branch/yugioh', icon: SparkleIcon },
      { label: 'Sports', href: '/branch/nfl', icon: SparkleIcon },
    ],
  },
];
