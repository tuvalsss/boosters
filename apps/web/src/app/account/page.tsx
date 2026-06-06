'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import type { KycStatus } from '@/lib/types';

const KYC_LABEL: Record<KycStatus, string> = {
  NONE: 'Not started',
  PENDING: 'Pending review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
};

export default function AccountPage() {
  const { ready, authenticated, login, dbUser, refreshMe, apiFetch } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [saving, setSaving] = useState(false);
  const [kycBusy, setKycBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    setDisplayName(dbUser?.displayName ?? '');
  }, [dbUser?.displayName]);

  if (!ready) return <Centered>Loading…</Centered>;
  if (!authenticated || !dbUser) {
    return (
      <Centered>
        <p className="mb-4 text-white/70">Sign in to view your account.</p>
        <button
          onClick={login}
          className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black"
        >
          Login
        </button>
      </Centered>
    );
  }

  const saveProfile = async () => {
    setSaving(true);
    setMsg(null);
    try {
      await apiFetch('/me', { method: 'PATCH', body: JSON.stringify({ displayName }) });
      await refreshMe();
      setMsg('Profile saved.');
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const startKyc = async () => {
    setKycBusy(true);
    setMsg(null);
    try {
      const res = await apiFetch<{ instructions: string }>('/kyc/start', { method: 'POST' });
      await refreshMe();
      setMsg(res.instructions);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setKycBusy(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 lg:px-8">
      <h1 className="text-3xl font-bold tracking-tight">My Account</h1>

      <section className="mt-6 space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <Field label="Email" value={dbUser.email ?? '—'} />
        <Field label="Solana wallet" value={dbUser.walletAddress ?? 'Not linked'} mono />
        <Field label="Role" value={dbUser.role} />
        <Field label="Account status" value={dbUser.hold === 'NONE' ? 'Active' : dbUser.hold} />

        <div>
          <label className="mb-1 block text-sm text-white/60" htmlFor="displayName">
            Display name
          </label>
          <div className="flex gap-2">
            <input
              id="displayName"
              value={displayName}
              maxLength={60}
              onChange={(e) => setDisplayName(e.target.value)}
              className="flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-white/30"
              placeholder="Add a display name"
            />
            <button
              onClick={saveProfile}
              disabled={saving}
              className="rounded-xl bg-white px-4 text-sm font-semibold text-black disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Identity verification (KYC)</h2>
            <p className="text-sm text-white/55">
              Status: <span className="text-white">{KYC_LABEL[dbUser.kycStatus]}</span>
            </p>
          </div>
          {dbUser.kycStatus !== 'APPROVED' && dbUser.kycStatus !== 'PENDING' && (
            <button
              onClick={startKyc}
              disabled={kycBusy}
              className="rounded-xl border border-white/15 px-4 py-2 text-sm font-medium hover:bg-white/5 disabled:opacity-60"
            >
              {kycBusy ? 'Starting…' : 'Start verification'}
            </button>
          )}
        </div>
        <p className="mt-3 text-xs text-white/40">
          Required for consignment and higher-volume selling (spec §7).
        </p>
      </section>

      {msg && <p className="mt-4 rounded-xl bg-white/5 px-4 py-3 text-sm text-white/80">{msg}</p>}
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-sm text-white/55">{label}</p>
      <p className={mono ? 'break-all font-mono text-sm' : 'text-sm'}>{value}</p>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      {children}
    </div>
  );
}
