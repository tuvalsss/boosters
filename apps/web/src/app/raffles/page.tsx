'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { publicFetch, usd } from '@/lib/api';
import type { RaffleRow } from '@/lib/types';

export default function RafflesPage() {
  const [raffles, setRaffles] = useState<RaffleRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    publicFetch<RaffleRow[]>('/raffles')
      .then(setRaffles)
      .catch(() => setRaffles([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 lg:px-8">
      <h1 className="text-3xl font-bold tracking-tight">Raffles</h1>
      <p className="text-sm text-white/55">
        Buy tickets on a vaulted card. When the raffle sells out, a provably-fair draw picks the
        winner.
      </p>

      {loading ? (
        <p className="mt-10 text-center text-white/40">Loading…</p>
      ) : raffles.length === 0 ? (
        <p className="mt-10 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-10 text-center text-white/40">
          No active raffles right now.
        </p>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {raffles.map((r) => {
            const pct = Math.round((r.ticketsSold / r.ticketSupply) * 100);
            const card = r.vaultItem.physicalCard;
            return (
              <Link
                key={r.id}
                href={`/raffles/${r.id}`}
                className="group overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] transition hover:border-white/20"
              >
                <div className="relative aspect-[5/7] bg-black/30">
                  {card.photos[0]?.url ? (
                    <Image
                      src={card.photos[0].url}
                      alt={card.cardName}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-white/30">
                      {card.grader} {card.grade}
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <p className="truncate text-sm font-semibold">{card.cardName}</p>
                  <p className="text-xs text-white/45">{usd(r.ticketPriceUsdc)} / ticket</p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full bg-emerald-400" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="mt-1 text-[11px] text-white/40">
                    {r.ticketsSold}/{r.ticketSupply} sold
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
