'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { isStaff, type Submission, type SubmissionStatus } from '@/lib/types';

const FILTERS: (SubmissionStatus | '')[] = [
  '',
  'IN_TRANSIT',
  'RECEIVED',
  'AUTHENTICATING',
  'GRADING',
  'PHOTOGRAPHED',
  'MINTED',
];

export default function AdminSubmissionsPage() {
  const { ready, authenticated, dbUser, apiFetch } = useAuth();
  const [subs, setSubs] = useState<Submission[]>([]);
  const [filter, setFilter] = useState<SubmissionStatus | ''>('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const staff = isStaff(dbUser?.role);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const q = filter ? `?status=${filter}` : '';
      setSubs(await apiFetch<Submission[]>(`/admin/submissions${q}`));
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [apiFetch, filter]);

  useEffect(() => {
    if (staff) void load();
  }, [staff, load]);

  if (!ready) return <Note>Loading…</Note>;
  if (!authenticated || !staff) return <Note>Staff access required.</Note>;

  const act = async (id: string, path: string, body?: object) => {
    setBusy(`${id}/${path}`);
    setErr(null);
    try {
      await apiFetch(`/admin/submissions/${id}/${path}`, {
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
    <div className="mx-auto w-full max-w-5xl px-4 py-8 lg:px-8">
      <h1 className="text-3xl font-bold tracking-tight">Consignment queue</h1>
      <p className="text-sm text-white/55">
        Receive, authenticate, grade, photograph and mint user-submitted cards. Every step is
        audited and shown on the user&apos;s timeline.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f || 'all'}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-xs ${filter === f ? 'bg-white text-black' : 'bg-white/10 text-white/70'}`}
          >
            {f ? f.replace('_', ' ') : 'All'}
          </button>
        ))}
      </div>

      {err && <p className="mt-4 rounded-xl bg-red-500/10 px-4 py-2 text-sm text-red-300">{err}</p>}

      <div className="mt-4 space-y-3">
        {subs.map((s) => (
          <OpsRow key={s.id} sub={s} busy={busy} onAct={act} />
        ))}
        {subs.length === 0 && <p className="py-8 text-center text-white/40">No submissions.</p>}
      </div>
    </div>
  );
}

function OpsRow({
  sub,
  busy,
  onAct,
}: {
  sub: Submission;
  busy: string | null;
  onAct: (id: string, path: string, body?: object) => void;
}) {
  const [grade, setGrade] = useState('');
  const [photo, setPhoto] = useState('');
  const d = sub.declaredCard;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center justify-between">
        <div>
          <span className="font-semibold">{d.cardName}</span>{' '}
          <span className="text-xs text-white/45">
            {d.category} · {d.grader} {d.certNumber ? `· #${d.certNumber}` : ''}
          </span>
          <div className="text-xs text-white/35">
            by {sub.user?.email ?? sub.user?.id}
            {sub.user && !sub.user.walletAddress && ' · ⚠ no wallet'}
          </div>
        </div>
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-white/70">
          {sub.status.replace('_', ' ')}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {(sub.status === 'IN_TRANSIT' || sub.status === 'LABEL_GENERATED') && (
          <Btn
            primary
            busy={busy === `${sub.id}/receive`}
            onClick={() =>
              onAct(sub.id, 'receive', {
                category: d.category,
                grader: d.grader,
                cardName: d.cardName,
                certNumber: d.certNumber,
              })
            }
          >
            Mark received
          </Btn>
        )}
        {sub.status === 'RECEIVED' && (
          <Btn
            busy={busy === `${sub.id}/authenticate`}
            onClick={() => onAct(sub.id, 'authenticate')}
          >
            Authenticate
          </Btn>
        )}
        {sub.status === 'AUTHENTICATING' && (
          <>
            <input
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              placeholder="Grade"
              className="h-9 w-24 rounded-lg border border-white/10 bg-black/30 px-2 text-sm outline-none focus:border-white/30"
            />
            <Btn
              busy={busy === `${sub.id}/grade`}
              disabled={!grade}
              onClick={() => onAct(sub.id, 'grade', { grade })}
            >
              Set grade
            </Btn>
          </>
        )}
        {sub.status === 'GRADING' && (
          <>
            <input
              value={photo}
              onChange={(e) => setPhoto(e.target.value)}
              placeholder="Photo URL"
              className="h-9 w-56 rounded-lg border border-white/10 bg-black/30 px-2 text-sm outline-none focus:border-white/30"
            />
            <Btn
              busy={busy === `${sub.id}/photos`}
              disabled={!photo}
              onClick={() => onAct(sub.id, 'photos', { urls: [photo] })}
            >
              Add photo
            </Btn>
          </>
        )}
        {sub.status === 'PHOTOGRAPHED' && (
          <Btn primary busy={busy === `${sub.id}/mint`} onClick={() => onAct(sub.id, 'mint')}>
            Mint to user
          </Btn>
        )}
        {!['MINTED', 'REJECTED', 'CANCELLED'].includes(sub.status) && (
          <button
            onClick={() => {
              const reason = window.prompt('Reject reason:');
              if (reason) onAct(sub.id, 'reject', { reason });
            }}
            className="text-xs text-red-300/70 hover:text-red-300"
          >
            Reject
          </button>
        )}
      </div>
    </div>
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
