'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ArrowRightIcon } from '@/components/icons';
import { PackTile } from '@/components/pack-tile';
import { useI18n } from '@/i18n/language-context';
import { BRANCHES } from '@/lib/branches';

const TEST_MODE_COPY = 'devnet sandbox - no real funds';

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

          <div className="order-1 flex justify-center lg:order-2">
            <div className="relative h-64 w-72 sm:h-80 sm:w-96">
              {BRANCHES.slice(0, 3).map((branch, index) => (
                <Image
                  key={branch.key}
                  src={branch.packImage}
                  alt={`${branch.name} pack`}
                  width={600}
                  height={900}
                  priority={index === 0}
                  className="absolute left-1/2 top-1/2 h-60 w-auto rounded-2xl shadow-2xl ring-1 ring-white/10 sm:h-72"
                  style={{
                    transform: `translate(-50%,-50%) translateX(${(index - 1) * 42}%) rotate(${
                      (index - 1) * 10
                    }deg)`,
                    zIndex: index === 1 ? 3 : 1,
                  }}
                />
              ))}
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
