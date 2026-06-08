'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { publicFetch, usd } from '@/lib/api';
import { BRANCHES } from '@/lib/branches';
import type { PackListItem } from '@/lib/types';
import { useI18n } from '@/i18n/language-context';

export default function PacksPage() {
  const { t } = useI18n();
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
      <h1 className="text-3xl font-bold tracking-tight">{t('packs.title')}</h1>
      <p className="text-sm text-white/55">{t('packs.subtitle')}</p>

      {loading ? (
        <p className="mt-10 text-center text-white/40">{t('common.loading')}</p>
      ) : packs.length === 0 ? (
        <p className="mt-10 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-10 text-center text-white/40">
          {t('packs.empty')}
        </p>
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
