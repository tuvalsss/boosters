'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { isStaff, type VaultItemRow, type VaultState } from '@/lib/types';

const CATEGORIES = ['POKEMON', 'SPORTS', 'TCG', 'OTHER'];
const GRADERS = ['PSA', 'BGS', 'CGC', 'SGC', 'RAW', 'OTHER'];

const STATE_STYLES: Record<VaultState, string> = {
  INTAKE: 'bg-white/10 text-white/70',
  AUTHENTICATING: 'bg-amber-500/20 text-amber-300',
  GRADED: 'bg-blue-500/20 text-blue-300',
  VAULTED: 'bg-emerald-500/20 text-emerald-300',
  RESERVED: 'bg-purple-500/20 text-purple-300',
  RELEASED: 'bg-white/5 text-white/40',
};

export default function VaultAdminPage() {
  const { ready, authenticated, dbUser, apiFetch } = useAuth();
  const [items, setItems] = useState<VaultItemRow[]>([]);
  const [filter, setFilter] = useState<VaultState | ''>('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const staff = isStaff(dbUser?.role);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const q = filter ? `?state=${filter}` : '';
      const res = await apiFetch<{ items: VaultItemRow[]; total: number }>(
        `/admin/vault/items${q}`,
      );
      setItems(res.items);
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [apiFetch, filter]);

  useEffect(() => {
    if (staff) void load();
  }, [staff, load]);

  if (!ready) return <Note>Loading…</Note>;
  if (!authenticated || !staff) return <Note>Staff access required.</Note>;

  const act = async (path: string, body?: object) => {
    setBusy(path);
    setErr(null);
    try {
      await apiFetch(`/admin/vault/${path}`, {
        method: 'POST',
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      await load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 lg:px-8">
      <h1 className="text-3xl font-bold tracking-tight">Vault · Intake & Grading</h1>
      <p className="text-sm text-white/55">
        Intake physical cards, authenticate, grade, then vault to mint the backing cNFT (custody
        gate). Every step is audited.
      </p>

      <IntakeForm onCreate={(dto) => act('intake', dto)} busy={busy === 'intake'} />

      <div className="mt-8 flex items-center gap-2">
        <span className="text-sm text-white/50">Filter:</span>
        {(['', 'INTAKE', 'AUTHENTICATING', 'GRADED', 'VAULTED'] as const).map((s) => (
          <button
            key={s || 'all'}
            onClick={() => setFilter(s)}
            className={`rounded-full px-3 py-1 text-xs ${filter === s ? 'bg-white text-black' : 'bg-white/10 text-white/70'}`}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      {err && <p className="mt-4 rounded-xl bg-red-500/10 px-4 py-2 text-sm text-red-300">{err}</p>}

      <div className="mt-4 space-y-3">
        {items.map((it) => (
          <VaultRow key={it.id} item={it} busy={busy} onAct={act} />
        ))}
        {items.length === 0 && <p className="py-8 text-center text-white/40">No items.</p>}
      </div>
    </div>
  );
}

function VaultRow({
  item,
  busy,
  onAct,
}: {
  item: VaultItemRow;
  busy: string | null;
  onAct: (path: string, body?: object) => void;
}) {
  const [grade, setGrade] = useState('');
  const c = item.physicalCard;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold">{c.cardName}</span>
          <span className={`rounded-full px-2 py-0.5 text-[11px] ${STATE_STYLES[item.state]}`}>
            {item.state}
          </span>
        </div>
        <div className="text-xs text-white/45">
          {c.category} · {c.grader} {c.grade ?? ''} {c.certNumber ? `· #${c.certNumber}` : ''}
        </div>
        <div className="text-xs text-white/35">
          owner: {item.owner.email ?? item.owner.id}
          {!item.owner.walletAddress && ' · ⚠ no wallet'}
        </div>
        {item.token && (
          <div className="mt-1 break-all font-mono text-[11px] text-emerald-300/80">
            cNFT {item.token.cnftAssetId}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        {item.state === 'INTAKE' && (
          <Btn
            busy={busy === `items/${item.id}/authenticate`}
            onClick={() => onAct(`items/${item.id}/authenticate`)}
          >
            Start authentication
          </Btn>
        )}
        {item.state === 'AUTHENTICATING' && (
          <>
            <input
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              placeholder="Grade (e.g. 10)"
              className="h-9 w-28 rounded-lg border border-white/10 bg-black/30 px-2 text-sm outline-none focus:border-white/30"
            />
            <Btn
              busy={busy === `items/${item.id}/grade`}
              disabled={!grade}
              onClick={() => onAct(`items/${item.id}/grade`, { grade })}
            >
              Set grade
            </Btn>
          </>
        )}
        {item.state === 'GRADED' && (
          <Btn
            primary
            busy={busy === `items/${item.id}/vault`}
            onClick={() => onAct(`items/${item.id}/vault`)}
          >
            Vault &amp; mint cNFT
          </Btn>
        )}
      </div>
    </div>
  );
}

function IntakeForm({ onCreate, busy }: { onCreate: (dto: object) => void; busy: boolean }) {
  const [form, setForm] = useState({
    category: 'POKEMON',
    grader: 'PSA',
    cardName: '',
    certNumber: '',
    grade: '',
  });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!form.cardName) return;
        onCreate({
          category: form.category,
          grader: form.grader,
          cardName: form.cardName,
          certNumber: form.certNumber || undefined,
          grade: form.grade || undefined,
        });
        setForm((f) => ({ ...f, cardName: '', certNumber: '', grade: '' }));
      }}
      className="mt-6 grid grid-cols-2 gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:grid-cols-6"
    >
      <select
        value={form.category}
        onChange={(e) => set('category', e.target.value)}
        className="rounded-lg border border-white/10 bg-black/40 px-2 py-2 text-sm"
      >
        {CATEGORIES.map((c) => (
          <option key={c} className="bg-booster-dark">
            {c}
          </option>
        ))}
      </select>
      <select
        value={form.grader}
        onChange={(e) => set('grader', e.target.value)}
        className="rounded-lg border border-white/10 bg-black/40 px-2 py-2 text-sm"
      >
        {GRADERS.map((g) => (
          <option key={g} className="bg-booster-dark">
            {g}
          </option>
        ))}
      </select>
      <input
        value={form.cardName}
        onChange={(e) => set('cardName', e.target.value)}
        placeholder="Card name"
        className="col-span-2 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-white/30"
      />
      <input
        value={form.certNumber}
        onChange={(e) => set('certNumber', e.target.value)}
        placeholder="Cert #"
        className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-white/30"
      />
      <button
        type="submit"
        disabled={busy || !form.cardName}
        className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black disabled:opacity-60"
      >
        {busy ? 'Adding…' : 'Add intake'}
      </button>
    </form>
  );
}

function Btn({
  children,
  onClick,
  busy,
  disabled,
  primary,
}: {
  children: React.ReactNode;
  onClick: () => void;
  busy?: boolean;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={busy || disabled}
      className={`h-9 rounded-lg px-3 text-sm font-medium disabled:opacity-50 ${
        primary
          ? 'bg-emerald-400 text-black hover:bg-emerald-300'
          : 'border border-white/15 hover:bg-white/5'
      }`}
    >
      {busy ? '…' : children}
    </button>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6 text-center text-white/70">
      {children}
    </div>
  );
}
