'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { useAuth } from '@/lib/auth-context';
import type { RedemptionRow, RedemptionStatus } from '@/lib/types';

const STATUS_STYLE: Record<RedemptionStatus, string> = {
  REQUESTED: 'bg-amber-500/20 text-amber-300',
  SHIPPED: 'bg-blue-500/20 text-blue-300',
  DELIVERED: 'bg-emerald-500/20 text-emerald-300',
};

export default function RedeemPage() {
  const { ready, authenticated, login, apiFetch } = useAuth();
  const [rows, setRows] = useState<RedemptionRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRows(await apiFetch<RedemptionRow[]>('/redeem'));
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [apiFetch]);

  useEffect(() => {
    if (authenticated) void load();
  }, [authenticated, load]);

  if (!ready) return <Center>Loading…</Center>;
  if (!authenticated)
    return (
      <Center>
        <p className="mb-4 text-white/70">Sign in to view your redemptions.</p>
        <button
          onClick={login}
          className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black"
        >
          Login
        </button>
      </Center>
    );

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 lg:px-8">
      <h1 className="text-3xl font-bold tracking-tight">Redemptions</h1>
      <p className="text-sm text-white/55">
        Redeeming burns the token and ships you the physical card. Start a redemption from your
        portfolio.
      </p>
      {err && <p className="mt-4 rounded-xl bg-red-500/10 px-4 py-2 text-sm text-red-300">{err}</p>}

      <div className="mt-6 space-y-3">
        {rows.map((r) => (
          <div
            key={r.id}
            className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3"
          >
            <div className="relative h-20 w-14 shrink-0 overflow-hidden rounded-lg bg-black/30">
              {r.vaultItem.physicalCard.photos[0]?.url && (
                <Image
                  src={r.vaultItem.physicalCard.photos[0].url}
                  alt=""
                  fill
                  className="object-cover"
                />
              )}
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold">{r.vaultItem.physicalCard.cardName}</p>
              <p className="text-xs text-white/45">
                Requested {new Date(r.createdAt).toLocaleDateString()}
              </p>
              {r.trackingNumber && (
                <p className="text-xs text-white/45">Tracking {r.trackingNumber}</p>
              )}
            </div>
            <span className={`rounded-full px-2 py-0.5 text-[11px] ${STATUS_STYLE[r.status]}`}>
              {r.status}
            </span>
          </div>
        ))}
        {rows.length === 0 && <p className="text-white/40">No redemptions yet.</p>}
      </div>
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center text-white/70">
      {children}
    </div>
  );
}
