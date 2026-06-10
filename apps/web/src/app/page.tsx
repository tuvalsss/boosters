'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ArrowRightIcon } from '@/components/icons';
import { PackArt } from '@/components/pack-art';
import { PackTile } from '@/components/pack-tile';
import { useI18n } from '@/i18n/language-context';
import { BRANCHES } from '@/lib/branches';

const TEST_MODE_COPY = 'devnet sandbox - no real funds';
const CAMPAIGN_IMAGES = [
  '/assets/brand-campaign/ambassadors-hero.png',
  '/assets/brand-campaign/operations-team.png',
  '/assets/brand-campaign/kiosk-ambassadors.png',
] as const;

export default function HomePage() {
  const { t } = useI18n();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 lg:px-8 lg:py-10">
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-transparent px-6 py-10 lg:px-12 lg:py-14">
        <div className="grid items-center gap-8 lg:grid-cols-2">
          <div className="order-2 lg:order-1">
            <span className="inline-block rounded-full border border-white/15 px-3 py-1 text-[11px] uppercase tracking-widest text-white/60">
              {t('home.mode')}
            </span>
            <h1 className="mt-4 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
              {t('home.title')} <span className="text-white/55">{t('home.titleMuted')}</span>
            </h1>
            <p className="mt-4 max-w-md text-base text-white/65">
              {t('home.subtitle')}{' '}
              <span className="rounded-md bg-emerald-300/15 px-1.5 py-0.5 font-semibold text-emerald-200">
                {t('home.demoNote')}
              </span>
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/demo"
                className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition hover:bg-white/90"
              >
                {t('home.tryDemo')} <ArrowRightIcon className="h-4 w-4" />
              </Link>
              <Link
                href="/packs"
                className="inline-flex items-center gap-2 rounded-full border border-white/15 px-6 py-3 text-sm font-semibold text-white/90 transition hover:bg-white/5"
              >
                {t('home.openPacks')}
              </Link>
              <Link
                href="/marketplace"
                className="inline-flex items-center gap-2 rounded-full border border-white/10 px-6 py-3 text-sm font-semibold text-white/70 transition hover:bg-white/5 hover:text-white"
              >
                {t('home.browseMarketplace')}
              </Link>
            </div>
          </div>

          <div className="order-1 lg:order-2">
            <div className="brand-campaign-rotator relative h-72 overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl shadow-black/40 sm:h-96">
              {CAMPAIGN_IMAGES.map((src, index) => (
                <Image
                  key={src}
                  src={src}
                  alt="Boosters brand ambassador campaign"
                  fill
                  priority={index === 0}
                  sizes="(min-width: 1024px) 44vw, 92vw"
                  className="brand-campaign-frame object-cover"
                  style={{ animationDelay: `${index * 6}s` }}
                />
              ))}
              <div className="absolute inset-0 bg-gradient-to-r from-black/45 via-black/5 to-transparent" />
              <div className="absolute bottom-4 left-4 flex items-end gap-2">
                {BRANCHES.slice(0, 3).map((branch, index) => (
                  <PackArt
                    key={branch.key}
                    src={branch.packImage}
                    alt={`${branch.name} pack`}
                    className="h-24 w-auto drop-shadow-2xl sm:h-32"
                    style={{
                      transform: `translateX(${index * -0.35}rem) rotate(${(index - 1) * 7}deg)`,
                      zIndex: 5 - index,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-12">
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-2xl font-bold tracking-tight">{t('home.openPacks')}</h2>
          <Link
            href="/packs"
            className="flex items-center gap-1 text-sm text-white/50 transition hover:text-white"
          >
            {t('home.instantBuyback')} <ArrowRightIcon className="h-4 w-4" />
          </Link>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {BRANCHES.map((branch) => (
            <PackTile key={branch.key} branch={branch} />
          ))}
        </div>
      </section>

      <footer
        aria-label={TEST_MODE_COPY}
        className="mt-14 border-t border-white/10 pt-6 text-xs text-white/40"
      >
        {t('home.footer')}
      </footer>
    </div>
  );
}
