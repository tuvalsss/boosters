'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { publicFetch, usd } from '@/lib/api';
import type { ListingRow } from '@/lib/types';

const CATEGORIES = ['', 'POKEMON', 'SPORTS', 'TCG', 'OTHER'] as const;

export default function MarketplacePage() {
  const [listings, setListings] = useState<ListingRow[]>([]);
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const params = new URLSearchParams();
      if (category) params.set('category', category);
      if (search) params.set('search', search);
      const res = await publicFetch<{ items: ListingRow[]; total: number }>(
        `/marketplace/listings?${params}`,
      );
      setListings(res.items);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [category, search]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 lg:px-8">
      <h1 className="text-3xl font-bold tracking-tight">Marketplace</h1>
      <p className="text-sm text-white/55">
        First-party & peer-to-peer listings. Every card is vaulted 1:1 and backed by a graded
        physical.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c || 'all'}
            onClick={() => setCategory(c)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium ${category === c ? 'bg-white text-black' : 'bg-white/10 text-white/70 hover:bg-white/15'}`}
          >
            {c || 'All'}
          </button>
        ))}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void load();
          }}
          className="ml-auto"
        >
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search cards…"
            className="h-9 w-48 rounded-xl border border-white/10 bg-black/30 px-3 text-sm outline-none focus:border-white/30"
          />
        </form>
      </div>

      {err && <p className="mt-4 rounded-xl bg-red-500/10 px-4 py-2 text-sm text-red-300">{err}</p>}

      {loading ? (
        <p className="mt-10 text-center text-white/40">Loading…</p>
      ) : listings.length === 0 ? (
        <p className="mt-10 text-center text-white/40">No active listings yet.</p>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {listings.map((l) => (
            <Link
              key={l.id}
              href={`/marketplace/${l.id}`}
              className="group overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] transition hover:border-white/20"
            >
              <div className="relative aspect-[5/7] bg-black/30">
                {l.vaultItem.physicalCard.photos[0]?.url ? (
                  <Image
                    src={l.vaultItem.physicalCard.photos[0].url}
                    alt={l.vaultItem.physicalCard.cardName}
                    fill
                    className="object-cover transition group-hover:scale-[1.02]"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-white/30">
                    {l.vaultItem.physicalCard.grader} {l.vaultItem.physicalCard.grade}
                  </div>
                )}
                {l.type === 'FIRST_PARTY' && (
                  <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] uppercase tracking-wide text-white/80">
                    Official
                  </span>
                )}
              </div>
              <div className="p-3">
                <p className="truncate text-sm font-semibold">
                  {l.vaultItem.physicalCard.cardName}
                </p>
                <p className="text-xs text-white/45">
                  {l.vaultItem.physicalCard.grader} {l.vaultItem.physicalCard.grade}
                </p>
                <p className="mt-1 font-semibold text-emerald-300">{usd(l.priceUsdc)}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
