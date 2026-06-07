'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { isStaff } from '@/lib/types';
import { NAV_SECTIONS, type NavSection } from './nav-data';
import { BagIcon, LayersIcon, SparkleIcon, TrophyIcon } from './icons';

/** Shared navigation list — rendered in both the desktop rail and mobile drawer. */
export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { authenticated, dbUser } = useAuth();

  // Auth-dependent section (Account, plus Admin for staff).
  const accountSection: NavSection | null = authenticated
    ? {
        title: 'Account',
        items: [
          { label: 'Portfolio', href: '/portfolio', icon: SparkleIcon },
          { label: 'My Account', href: '/account', icon: BagIcon },
          ...(isStaff(dbUser?.role)
            ? [
                { label: 'Admin', href: '/admin', icon: TrophyIcon },
                { label: 'Vault', href: '/admin/vault', icon: LayersIcon },
                { label: 'Submissions', href: '/admin/submissions', icon: BagIcon },
                { label: 'Packs (admin)', href: '/admin/packs', icon: LayersIcon },
                { label: 'Treasury', href: '/admin/treasury', icon: TrophyIcon },
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
              {section.title}
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
                <span className="flex-1">{item.label}</span>
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
