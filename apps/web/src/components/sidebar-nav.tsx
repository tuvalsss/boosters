'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { isStaff } from '@/lib/types';
import { useI18n } from '@/i18n/language-context';
import { NAV_SECTIONS, type NavSection } from './nav-data';
import { BagIcon, GiftIcon, LayersIcon, SparkleIcon, TrophyIcon } from './icons';

/** Shared navigation list — rendered in both the desktop rail and mobile drawer. */
export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { authenticated, dbUser } = useAuth();
  const { t } = useI18n();

  // Auth-dependent section (Account, plus Admin for staff).
  const accountSection: NavSection | null = authenticated
    ? {
        title: 'Account',
        items: [
          { label: 'Portfolio', labelKey: 'nav.portfolio', href: '/portfolio', icon: SparkleIcon },
          { label: 'Redemptions', labelKey: 'nav.redemptions', href: '/redeem', icon: GiftIcon },
          { label: 'My Account', labelKey: 'nav.myAccount', href: '/account', icon: BagIcon },
          ...(isStaff(dbUser?.role)
            ? [
                { label: 'Admin', labelKey: 'nav.admin', href: '/admin', icon: TrophyIcon },
                { label: 'Vault', labelKey: 'nav.vault', href: '/admin/vault', icon: LayersIcon },
                {
                  label: 'Submissions',
                  labelKey: 'nav.submissions',
                  href: '/admin/submissions',
                  icon: BagIcon,
                },
                { label: 'KYC', labelKey: 'nav.kyc', href: '/admin/kyc', icon: BagIcon },
                {
                  label: 'Packs (admin)',
                  labelKey: 'nav.adminPacks',
                  href: '/admin/packs',
                  icon: LayersIcon,
                },
                {
                  label: 'Treasury',
                  labelKey: 'nav.treasury',
                  href: '/admin/treasury',
                  icon: TrophyIcon,
                },
                {
                  label: 'Redemptions',
                  labelKey: 'nav.redemptions',
                  href: '/admin/redemptions',
                  icon: GiftIcon,
                },
                {
                  label: 'Review queue',
                  labelKey: 'nav.reviewQueue',
                  href: '/admin/review',
                  icon: SparkleIcon,
                },
              ]
            : []),
        ],
      }
    : null;

  const sections = accountSection ? [...NAV_SECTIONS, accountSection] : NAV_SECTIONS;

  return (
    <nav className="flex flex-col gap-6">
      {sections.map((section, i) => (
        <div key={section.title ?? `primary-${i}`} className="flex flex-col gap-1">
          {section.title && (
            <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-widest text-white/35">
              {sectionTitle(section.title, t)}
            </p>
          )}
          {section.items.map((item) => {
            const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? 'page' : undefined}
                className={[
                  'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium transition',
                  active
                    ? 'bg-white/10 text-white ring-1 ring-white/10'
                    : 'text-white/70 hover:bg-white/5 hover:text-white',
                ].join(' ')}
              >
                <span
                  className={[
                    'flex h-9 w-9 items-center justify-center rounded-lg transition',
                    active
                      ? 'bg-white/10 text-white'
                      : 'bg-white/5 text-white/70 group-hover:text-white',
                  ].join(' ')}
                >
                  <Icon />
                </span>
                <span className="flex-1">{item.labelKey ? t(item.labelKey) : item.label}</span>
                {item.badge && (
                  <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-black">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

function sectionTitle(title: string, t: (key: string) => string) {
  if (title === 'Community') return t('nav.community');
  if (title === 'More') return t('nav.more');
  if (title === 'Account') return t('shell.account');
  return title;
}
