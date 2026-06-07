'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import type { Submission, SubmissionStatus } from '@/lib/types';

const CATEGORIES = ['POKEMON', 'SPORTS', 'TCG', 'OTHER'];
const GRADERS = ['PSA', 'BGS', 'CGC', 'SGC', 'RAW', 'OTHER'];

const STATUS_STYLE: Record<SubmissionStatus, string> = {
  DRAFT: 'bg-white/10 text-white/70',
  LABEL_GENERATED: 'bg-blue-500/20 text-blue-300',
  IN_TRANSIT: 'bg-amber-500/20 text-amber-300',
  RECEIVED: 'bg-cyan-500/20 text-cyan-300',
  AUTHENTICATING: 'bg-amber-500/20 text-amber-300',
  GRADING: 'bg-purple-500/20 text-purple-300',
  PHOTOGRAPHED: 'bg-purple-500/20 text-purple-300',
  MINTED: 'bg-emerald-500/20 text-emerald-300',
  REJECTED: 'bg-red-500/20 text-red-300',
  CANCELLED: 'bg-white/5 text-white/40',
};

export default function SubmitPage() {
  const { ready, authenticated, login, apiFetch } = useAuth();
  const [subs, setSubs] = useState<Submission[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setSubs(await apiFetch<Submission[]>('/submissions'));
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [apiFetch]);

  useEffect(() => {
    if (authenticated) void load();
  }, [authenticated, load]);

  if (!ready) return <Center>Loading…</Center>;
  if (!authenticated) {
    return (
      <Center>
        <p className="mb-4 text-white/70">Sign in to consign a card.</p>
        <button
          onClick={login}
          className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black"
        >
          Login
        </button>
      </Center>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 lg:px-8">
      <h1 className="text-3xl font-bold tracking-tight">Submit a card</h1>
      <p className="text-sm text-white/55">
        Ship in a graded card. Once we receive, authenticate and grade it, we mint a 1:1 token to
        your wallet — then you can hold, trade or redeem it.
      </p>

      <NewSubmissionForm onCreated={load} />

      {err && <p className="mt-4 rounded-xl bg-red-500/10 px-4 py-2 text-sm text-red-300">{err}</p>}

      <h2 className="mb-3 mt-10 text-lg font-semibold">My submissions</h2>
      <div className="space-y-3">
        {subs.map((s) => (
          <SubmissionCard key={s.id} sub={s} onChange={load} />
        ))}
        {subs.length === 0 && <p className="text-white/40">No submissions yet.</p>}
      </div>
    </div>
  );
}

function NewSubmissionForm({ onCreated }: { onCreated: () => void }) {
  const { apiFetch } = useAuth();
  const [form, setForm] = useState({
    category: 'POKEMON',
    grader: 'PSA',
    cardName: '',
    certNumber: '',
    declaredGrade: '',
  });
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!form.cardName) return;
        setBusy(true);
        try {
          await apiFetch('/submissions', {
            method: 'POST',
            body: JSON.stringify({
              category: form.category,
              grader: form.grader,
              cardName: form.cardName,
              certNumber: form.certNumber || undefined,
              declaredGrade: form.declaredGrade || undefined,
            }),
          });
          setForm((f) => ({ ...f, cardName: '', certNumber: '', declaredGrade: '' }));
          onCreated();
        } finally {
          setBusy(false);
        }
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
        {busy ? '…' : 'Declare'}
      </button>
    </form>
  );
}

function SubmissionCard({ sub, onChange }: { sub: Submission; onChange: () => void }) {
  const { apiFetch } = useAuth();
  const [tracking, setTracking] = useState('');
  const [busy, setBusy] = useState(false);

  const act = async (path: string, body?: object) => {
    setBusy(true);
    try {
      await apiFetch(`/submissions/${sub.id}/${path}`, {
        method: 'POST',
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      onChange();
    } finally {
      setBusy(false);
    }
  };

  const canCancel = ['DRAFT', 'LABEL_GENERATED', 'IN_TRANSIT'].includes(sub.status);
  const ref = sub.shippingLabelUrl?.replace('ref:', '');

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center justify-between">
        <div>
          <span className="font-semibold">{sub.declaredCard.cardName}</span>
          <span className="ml-2 text-xs text-white/45">
            {sub.declaredCard.grader} {sub.declaredCard.declaredGrade ?? ''}
          </span>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-[11px] ${STATUS_STYLE[sub.status]}`}>
          {sub.status.replace('_', ' ')}
        </span>
      </div>

      {sub.status === 'DRAFT' && (
        <button
          onClick={() => act('label')}
          disabled={busy}
          className="mt-3 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-black disabled:opacity-60"
        >
          Generate shipping label
        </button>
      )}

      {sub.status === 'LABEL_GENERATED' && (
        <div className="mt-3 space-y-2">
          <p className="text-sm text-white/70">
            Ship your card with reference <span className="font-mono text-white">{ref}</span> to the
            Boosters vault, then add your tracking number:
          </p>
          <div className="flex gap-2">
            <input
              value={tracking}
              onChange={(e) => setTracking(e.target.value)}
              placeholder="Tracking #"
              className="h-9 flex-1 rounded-lg border border-white/10 bg-black/30 px-3 text-sm outline-none focus:border-white/30"
            />
            <button
              onClick={() => act('ship', { trackingNumber: tracking })}
              disabled={busy || !tracking}
              className="h-9 rounded-lg bg-white px-3 text-sm font-semibold text-black disabled:opacity-50"
            >
              Mark shipped
            </button>
          </div>
        </div>
      )}

      {sub.status === 'MINTED' && (
        <p className="mt-3 text-sm text-emerald-300">
          Tokenized! Your card is now in your portfolio.
          {sub.vaultItem?.token && (
            <span className="ml-1 break-all font-mono text-[11px] text-white/40">
              {sub.vaultItem.token.cnftAssetId}
            </span>
          )}
        </p>
      )}

      {/* Timeline */}
      <ol className="mt-4 space-y-1.5 border-t border-white/5 pt-3">
        {sub.events.map((ev) => (
          <li key={ev.id} className="flex items-center gap-2 text-xs text-white/50">
            <span className="h-1.5 w-1.5 rounded-full bg-white/30" />
            <span className="text-white/70">{ev.status.replace('_', ' ')}</span>
            {ev.note && <span className="text-white/40">— {ev.note}</span>}
            <span className="ml-auto text-white/25">{new Date(ev.createdAt).toLocaleString()}</span>
          </li>
        ))}
      </ol>

      {canCancel && (
        <button
          onClick={() => act('cancel')}
          disabled={busy}
          className="mt-3 text-xs text-white/40 hover:text-white/70"
        >
          Cancel submission
        </button>
      )}
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
