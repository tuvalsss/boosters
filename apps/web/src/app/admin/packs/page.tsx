'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { usd } from '@/lib/api';
import { isStaff } from '@/lib/types';
import { useI18n } from '@/i18n/language-context';
import { PackArt } from '@/components/pack-art';
import { PACK_ASSET_PRESETS } from '@/lib/pack-assets';

interface AdminPack {
  id: string;
  name: string;
  description: string | null;
  priceUsdc: string;
  status: string;
  brandLabel: string;
  coverImageUrl: string | null;
  accentColor: string;
  tier: string;
  _count?: { poolItems: number };
}

export default function AdminPacksPage() {
  const { ready, authenticated, dbUser, apiFetch } = useAuth();
  const { t } = useI18n();
  const [packs, setPacks] = useState<AdminPack[]>([]);
  const [form, setForm] = useState({
    name: 'Boosters Rookie Pack',
    description: 'Original Boosters pack with transparent odds.',
    priceUsdc: '35',
    brandLabel: 'BOOSTERS',
    coverImageUrl: PACK_ASSET_PRESETS[0]!,
    accentColor: '#1fbf75',
    tier: 'CORE',
    weights: '{ "common": 20, "rare": 4, "chase": 1 }',
  });
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

  const weights = useMemo(() => {
    try {
      return JSON.parse(form.weights) as Record<string, number>;
    } catch {
      return null;
    }
  }, [form.weights]);

  if (!ready) return <Note>{t('common.loading')}</Note>;
  if (!authenticated || !staff) return <Note>Staff access required.</Note>;

  const set = (key: keyof typeof form, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const create = async () => {
    if (!weights) {
      setErr('Weights must be valid JSON');
      return;
    }
    try {
      await apiFetch('/admin/packs', {
        method: 'POST',
        body: JSON.stringify({ ...form, weights }),
      });
      await load();
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const addPool = async (id: string) => {
    const vaultItemId = window.prompt('Vault item id to add to the pool (must be VAULTED):');
    if (!vaultItemId) return;
    const tier = window.prompt('Pool tier, e.g. common / rare / chase:', 'common') || 'common';
    try {
      await apiFetch(`/admin/packs/${id}/pool`, {
        method: 'POST',
        body: JSON.stringify({ vaultItemId, tier }),
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

  const updateVisual = async (pack: AdminPack) => {
    const coverImageUrl = window.prompt(t('admin.coverImage'), pack.coverImageUrl ?? '') ?? '';
    const brandLabel = window.prompt(t('admin.brandLabel'), pack.brandLabel) ?? pack.brandLabel;
    const accentColor = window.prompt(t('admin.accentColor'), pack.accentColor) ?? pack.accentColor;
    const tier = window.prompt(t('admin.tier'), pack.tier) ?? pack.tier;
    try {
      await apiFetch(`/admin/packs/${pack.id}/visual`, {
        method: 'PATCH',
        body: JSON.stringify({ coverImageUrl, brandLabel, accentColor, tier }),
      });
      await load();
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 lg:px-8">
      <h1 className="text-3xl font-bold tracking-tight">{t('nav.adminPacks')}</h1>
      <p className="text-sm text-white/55">
        Create packs, style them with production-safe Boosters assets, then add vaulted cards to the
        prize pool.
      </p>

      <section className="mt-6 grid gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 lg:grid-cols-[220px_1fr]">
        <div
          className="rounded-2xl border border-white/10 p-4"
          style={{ background: `linear-gradient(145deg, ${form.accentColor}35, transparent)` }}
        >
          <div className="mx-auto flex h-64 justify-center">
            <PackArt src={form.coverImageUrl} alt="Pack preview" className="h-64" />
          </div>
          <p className="mt-3 truncate text-center text-sm font-semibold">{form.name}</p>
          <p className="text-center text-xs text-white/45">
            {form.brandLabel} · {form.tier}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Pack name" value={form.name} onChange={(v) => set('name', v)} />
          <Input label="Price USDC" value={form.priceUsdc} onChange={(v) => set('priceUsdc', v)} />
          <Input
            label={t('admin.brandLabel')}
            value={form.brandLabel}
            onChange={(v) => set('brandLabel', v)}
          />
          <Input label={t('admin.tier')} value={form.tier} onChange={(v) => set('tier', v)} />
          <Input
            label={t('admin.accentColor')}
            value={form.accentColor}
            onChange={(v) => set('accentColor', v)}
          />
          <input
            value={form.coverImageUrl}
            onChange={(e) => set('coverImageUrl', e.target.value)}
            placeholder={t('admin.coverImage')}
            list="pack-asset-presets"
            className="h-10 rounded-lg border border-white/10 bg-black/30 px-3 text-sm outline-none focus:border-white/30"
          />
          <datalist id="pack-asset-presets">
            {PACK_ASSET_PRESETS.map((asset) => (
              <option key={asset} value={asset} />
            ))}
          </datalist>
          <input
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            placeholder="Description"
            className="h-10 rounded-lg border border-white/10 bg-black/30 px-3 text-sm outline-none focus:border-white/30 sm:col-span-2"
          />
          <textarea
            value={form.weights}
            onChange={(e) => set('weights', e.target.value)}
            className="min-h-24 rounded-lg border border-white/10 bg-black/30 px-3 py-2 font-mono text-sm outline-none focus:border-white/30 sm:col-span-2"
            placeholder={t('admin.weights')}
          />
          <button
            onClick={create}
            disabled={!form.name || !form.priceUsdc || !weights}
            className="h-10 rounded-lg bg-white px-4 text-sm font-semibold text-black disabled:opacity-50 sm:col-span-2"
          >
            {t('admin.createPack')}
          </button>
        </div>
      </section>

      {err && <p className="mt-4 rounded-xl bg-red-500/10 px-4 py-2 text-sm text-red-300">{err}</p>}

      <div className="mt-6 grid gap-3 lg:grid-cols-2">
        {packs.map((p) => (
          <div
            key={p.id}
            className="flex gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4"
          >
            <div
              className="relative h-36 w-24 shrink-0 rounded-xl border border-white/10"
              style={{ background: `linear-gradient(145deg, ${p.accentColor}35, transparent)` }}
            >
              <PackArt
                src={p.coverImageUrl ?? PACK_ASSET_PRESETS[0]!}
                alt={p.name}
                className="h-full"
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate font-semibold">{p.name}</h2>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-white/60">
                  {p.tier}
                </span>
              </div>
              <p className="mt-1 text-xs text-white/45">
                {usd(p.priceUsdc)} · {p._count?.poolItems ?? 0} in pool · {p.status}
              </p>
              {p.description && <p className="mt-2 text-sm text-white/55">{p.description}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={() => addPool(p.id)}
                  className="h-9 rounded-lg border border-white/15 px-3 text-sm hover:bg-white/5"
                >
                  Add card
                </button>
                <button
                  onClick={() => updateVisual(p)}
                  className="h-9 rounded-lg border border-white/15 px-3 text-sm hover:bg-white/5"
                >
                  {t('admin.updateVisual')}
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
          </div>
        ))}
        {packs.length === 0 && <p className="py-8 text-center text-white/40">No packs yet.</p>}
      </div>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={label}
      className="h-10 rounded-lg border border-white/10 bg-black/30 px-3 text-sm outline-none focus:border-white/30"
    />
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6 text-center text-white/70">
      {children}
    </div>
  );
}
