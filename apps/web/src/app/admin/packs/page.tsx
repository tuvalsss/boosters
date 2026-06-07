'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { usd } from '@/lib/api';
import { isStaff } from '@/lib/types';

interface AdminPack {
  id: string;
  name: string;
  priceUsdc: string;
  status: string;
  _count?: { poolItems: number };
}

export default function AdminPacksPage() {
  const { ready, authenticated, dbUser, apiFetch } = useAuth();
  const [packs, setPacks] = useState<AdminPack[]>([]);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const staff = isStaff(dbUser?.role);

  const load = useCallback(async () => {
    setErr(null);
    try {
      setPacks(await apiFetch<AdminPack[]>('/admin/packs'));
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [apiFetch]);

  useEffect(() => {
    if (staff) void load();
  }, [staff, load]);

  if (!ready) return <Note>Loading…</Note>;
  if (!authenticated || !staff) return <Note>Staff access required.</Note>;

  const create = async () => {
    try {
      await apiFetch('/admin/packs', {
        method: 'POST',
        body: JSON.stringify({ name, priceUsdc: price }),
      });
      setName('');
      setPrice('');
      await load();
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const addPool = async (id: string) => {
    const vaultItemId = window.prompt('Vault item id to add to the pool (must be VAULTED):');
    if (!vaultItemId) return;
    try {
      await apiFetch(`/admin/packs/${id}/pool`, {
        method: 'POST',
        body: JSON.stringify({ vaultItemId }),
      });
      await load();
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const setStatus = async (id: string, to: string) => {
    try {
      await apiFetch(`/admin/packs/${id}/status?to=${to}`, { method: 'POST' });
      await load();
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 lg:px-8">
      <h1 className="text-3xl font-bold tracking-tight">Packs</h1>
      <p className="text-sm text-white/55">
        Create packs, add vaulted cards to the prize pool, and activate. Draws are provably fair.
      </p>

      <div className="mt-6 flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Pack name"
          className="h-10 flex-1 rounded-lg border border-white/10 bg-black/30 px-3 text-sm outline-none focus:border-white/30"
        />
        <input
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="Price USDC"
          className="h-10 w-32 rounded-lg border border-white/10 bg-black/30 px-3 text-sm outline-none focus:border-white/30"
        />
        <button
          onClick={create}
          disabled={!name || !price}
          className="h-10 rounded-lg bg-white px-4 text-sm font-semibold text-black disabled:opacity-50"
        >
          Create pack
        </button>
      </div>

      {err && <p className="mt-4 rounded-xl bg-red-500/10 px-4 py-2 text-sm text-red-300">{err}</p>}

      <div className="mt-6 space-y-3">
        {packs.map((p) => (
          <div
            key={p.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4"
          >
            <div>
              <span className="font-semibold">{p.name}</span>
              <span className="ml-2 text-xs text-white/45">
                {usd(p.priceUsdc)} · {p._count?.poolItems ?? 0} in pool · {p.status}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => addPool(p.id)}
                className="h-9 rounded-lg border border-white/15 px-3 text-sm hover:bg-white/5"
              >
                Add card
              </button>
              {p.status !== 'ACTIVE' ? (
                <button
                  onClick={() => setStatus(p.id, 'ACTIVE')}
                  className="h-9 rounded-lg bg-emerald-400 px-3 text-sm font-semibold text-black hover:bg-emerald-300"
                >
                  Activate
                </button>
              ) : (
                <button
                  onClick={() => setStatus(p.id, 'PAUSED')}
                  className="h-9 rounded-lg border border-white/15 px-3 text-sm hover:bg-white/5"
                >
                  Pause
                </button>
              )}
            </div>
          </div>
        ))}
        {packs.length === 0 && <p className="py-8 text-center text-white/40">No packs yet.</p>}
      </div>
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6 text-center text-white/70">
      {children}
    </div>
  );
}
