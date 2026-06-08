'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { publicFetch, usd } from '@/lib/api';
import { BRANCHES } from '@/lib/branches';
import type { PackListItem } from '@/lib/types';
import { useI18n } from '@/i18n/language-context';
import { ArrowRightIcon } from '@/components/icons';
import { useAuth } from '@/lib/auth-context';

export default function PacksPage() {
  const { t } = useI18n();
  const { authenticated, login } = useAuth();
  const [packs, setPacks] = useState<PackListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    publicFetch<PackListItem[]>('/packs')
      .then(setPacks)
      .catch(() => setPacks([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 lg:px-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('packs.title')}</h1>
          <p className="text-sm text-white/55">{t('packs.subtitle')}</p>
        </div>
        <Link
          href="/demo"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-emerald-300/20 bg-emerald-300/10 px-4 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-300/15"
        >
          {t('packs.tryDemo')} <ArrowRightIcon className="h-4 w-4" />
        </Link>
      </div>

      {!authenticated && (
        <section className="mt-6 grid gap-4 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <h2 className="text-base font-bold text-emerald-50">{t('packs.guestTitle')}</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-emerald-50/70">
              {t('packs.guestSubtitle')}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={login}
              className="inline-flex h-10 items-center justify-center rounded-xl bg-white px-4 text-sm font-bold text-black transition hover:bg-white/90"
            >
              {t('common.login')}
            </button>
            <Link
              href="/demo"
              className="inline-flex h-10 items-center justify-center rounded-xl border border-white/15 px-4 text-sm font-bold text-white transition hover:bg-white/10"
            >
              {t('common.tryDemo')}
            </Link>
          </div>
        </section>
      )}

      {loading ? (
        <p className="mt-10 text-center text-white/40">{t('common.loading')}</p>
      ) : packs.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-10 text-center">
          <p className="text-white/50">{t('packs.empty')}</p>
          <Link
            href="/demo"
            className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-semibold text-black transition hover:bg-white/90"
          >
            {t('packs.emptyCta')} <ArrowRightIcon className="h-4 w-4" />
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {packs.map((p, i) => (
            <Link
              key={p.id}
              href={`/packs/${p.id}`}
              className="group overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-white/20"
              style={{ background: `linear-gradient(145deg, ${p.accentColor}22, transparent)` }}
            >
              <div className="relative mx-auto h-44 w-28">
                <Image
                  src={p.coverImageUrl ?? BRANCHES[i % BRANCHES.length]!.packImage}
                  alt={p.name}
                  fill
                  className="object-contain transition group-hover:-translate-y-1"
                />
              </div>
              <p className="mt-3 truncate text-sm font-semibold">{p.name}</p>
              <p className="truncate text-[11px] uppercase tracking-wide text-white/35">
                {p.brandLabel} · {p.tier}
              </p>
              <div className="mt-1 flex items-center justify-between text-xs">
                <span className="text-white/45">
                  {p._count?.poolItems ?? 0} {t('packs.left')}
                </span>
                <span className="font-semibold text-emerald-300">{usd(p.priceUsdc)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
