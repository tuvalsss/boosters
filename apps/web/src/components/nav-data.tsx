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
  labelKey?: string;
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  badge?: string;
}

export interface NavSection {
  title?: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { label: 'Home', labelKey: 'nav.home', href: '/', icon: HomeIcon },
      { label: 'Try Demo', labelKey: 'nav.demo', href: '/demo', icon: SparkleIcon, badge: 'TRY' },
      { label: 'Packs', labelKey: 'nav.packs', href: '/packs', icon: LayersIcon, badge: 'NEW' },
      { label: 'Pack Party', labelKey: 'nav.packParty', href: '/pack-party', icon: PartyIcon },
      { label: 'Marketplace', labelKey: 'nav.marketplace', href: '/marketplace', icon: BagIcon },
      { label: 'Raffles', labelKey: 'nav.raffles', href: '/raffles', icon: TrophyIcon },
      { label: 'Submit a card', labelKey: 'nav.submit', href: '/submit', icon: GiftIcon },
      { label: 'Leaderboard', labelKey: 'nav.leaderboard', href: '/leaderboard', icon: TrophyIcon },
    ],
  },
  {
    title: 'Community',
    items: [
      { label: 'Activity', labelKey: 'nav.activity', href: '/activity', icon: ClockIcon },
      { label: 'Refer & Earn', labelKey: 'nav.refer', href: '/refer', icon: GiftIcon },
    ],
  },
  {
    title: 'More',
    items: [
      { label: 'Creature TCG', href: '/branch/creature', icon: SparkleIcon },
      { label: 'Adventure TCG', href: '/branch/adventure', icon: SparkleIcon },
      { label: 'Arcana Duel', href: '/branch/arcana', icon: SparkleIcon },
      { label: 'Sports Icons', href: '/branch/sports', icon: SparkleIcon },
    ],
  },
];
