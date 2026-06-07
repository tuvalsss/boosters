'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { publicFetch, usd } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { isStaff, type RaffleRow } from '@/lib/types';

export default function RaffleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { authenticated, login, apiFetch, dbUser, refreshMe } = useAuth();
  const [raffle, setRaffle] = useState<RaffleRow | null>(null);
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRaffle(await publicFetch<RaffleRow>(`/raffles/${id}`));
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (err && !raffle) return <Center>{err}</Center>;
  if (!raffle) return <Center>Loading…</Center>;

  const card = raffle.vaultItem.physicalCard;
  const remaining = raffle.ticketSupply - raffle.ticketsSold;
  const pct = Math.round((raffle.ticketsSold / raffle.ticketSupply) * 100);
  const staff = isStaff(dbUser?.role);
  const settled = raffle.status === 'SETTLED';

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      await fn();
      await load();
      await refreshMe();
      if (ok) setMsg(ok);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-8 px-4 py-10 sm:grid-cols-2 lg:px-8">
      <div className="relative aspect-[5/7] overflow-hidden rounded-2xl border border-white/10 bg-black/30">
        {card.photos[0]?.url ? (
          <Image src={card.photos[0].url} alt={card.cardName} fill className="object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-white/30">No image</div>
        )}
      </div>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">{card.cardName}</h1>
        <p className="mt-1 text-white/60">
          {card.grader} {card.grade} · {usd(raffle.ticketPriceUsdc)} / ticket
        </p>

        <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
          <div className="h-full bg-emerald-400" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-1 text-sm text-white/50">
          {raffle.ticketsSold}/{raffle.ticketSupply} tickets sold · status {raffle.status}
        </p>

        {settled ? (
          <div className="mt-6 rounded-2xl border border-emerald-400/30 bg-emerald-400/5 p-4">
            <p className="text-sm">
              Winner:{' '}
              {raffle.winnerId === dbUser?.id
                ? 'You won! 🎉'
                : `ticket holder ${raffle.winnerId?.slice(0, 8)}…`}
            </p>
          </div>
        ) : raffle.status === 'CANCELLED' ? (
          <p className="mt-6 text-white/60">This raffle was cancelled and tickets refunded.</p>
        ) : (
          <div className="mt-6 flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={Math.max(remaining, 1)}
              value={qty}
              onChange={(e) => setQty(Math.max(1, Number(e.target.value)))}
              className="h-11 w-20 rounded-xl border border-white/10 bg-black/30 px-3 text-sm outline-none focus:border-white/30"
            />
            <button
              onClick={() =>
                authenticated
                  ? run(
                      () =>
                        apiFetch(`/raffles/${id}/tickets`, {
                          method: 'POST',
                          body: JSON.stringify({ quantity: qty }),
                        }),
                      'Tickets purchased!',
                    )
                  : login()
              }
              disabled={busy || remaining === 0}
              className="h-11 flex-1 rounded-full bg-white text-sm font-semibold text-black hover:bg-white/90 disabled:opacity-60"
            >
              {remaining === 0
                ? 'Sold out'
                : authenticated
                  ? `Buy ${qty} for ${usd(Number(raffle.ticketPriceUsdc) * qty)}`
                  : 'Login to enter'}
            </button>
          </div>
        )}

        {staff && (raffle.status === 'SOLD_OUT' || raffle.status === 'ACTIVE') && (
          <div className="mt-6 flex gap-2 border-t border-white/10 pt-4">
            {raffle.status === 'SOLD_OUT' && (
              <button
                onClick={() =>
                  run(() => apiFetch(`/admin/raffles/${id}/draw`, { method: 'POST' }), 'Drawn!')
                }
                disabled={busy}
                className="h-10 rounded-lg bg-emerald-400 px-4 text-sm font-semibold text-black"
              >
                Draw winner
              </button>
            )}
            <button
              onClick={() =>
                run(
                  () => apiFetch(`/admin/raffles/${id}/cancel`, { method: 'POST' }),
                  'Cancelled + refunded',
                )
              }
              disabled={busy}
              className="h-10 rounded-lg border border-white/15 px-4 text-sm"
            >
              Cancel &amp; refund
            </button>
          </div>
        )}

        {msg && <p className="mt-4 text-sm text-emerald-300">{msg}</p>}
        {err && <p className="mt-4 text-sm text-red-300">{err}</p>}
      </div>
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6 text-center text-white/70">
      {children}
    </div>
  );
}
