'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import {
  isStaff,
  type AccountHold,
  type KycStatus,
  type PublicUser,
  type UserRole,
} from '@/lib/types';

const ROLES: UserRole[] = ['USER', 'OPS', 'ADMIN'];
const KYCS: KycStatus[] = ['NONE', 'PENDING', 'APPROVED', 'REJECTED'];
const HOLDS: AccountHold[] = ['NONE', 'NEW_ACCOUNT', 'MANUAL_REVIEW', 'SUSPENDED'];

export default function AdminPage() {
  const { ready, authenticated, dbUser, apiFetch } = useAuth();
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const staff = isStaff(dbUser?.role);
  const isAdmin = dbUser?.role === 'ADMIN';

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const q = search ? `?search=${encodeURIComponent(search)}` : '';
      const res = await apiFetch<{ items: PublicUser[]; total: number }>(`/admin/users${q}`);
      setUsers(res.items);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [apiFetch, search]);

  useEffect(() => {
    if (staff) void load();
  }, [staff, load]);

  if (!ready) return <Note>Loading…</Note>;
  if (!authenticated) return <Note>Sign in with a staff account to access the admin panel.</Note>;
  if (!staff) return <Note>You do not have permission to view this page.</Note>;

  const patch = async (id: string, path: string, body: object) => {
    try {
      await apiFetch(`/admin/users/${id}/${path}`, { method: 'PATCH', body: JSON.stringify(body) });
      await load();
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin · Ops</h1>
          <p className="text-sm text-white/55">
            Users, roles, KYC and holds. Every change is written to the audit log.
          </p>
        </div>
        <div className="flex gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search email / name / wallet"
            className="h-10 w-64 rounded-xl border border-white/10 bg-black/30 px-3 text-sm outline-none focus:border-white/30"
          />
          <button
            onClick={load}
            className="rounded-xl bg-white px-4 text-sm font-semibold text-black"
          >
            Search
          </button>
        </div>
      </div>

      {err && <p className="mt-4 rounded-xl bg-red-500/10 px-4 py-2 text-sm text-red-300">{err}</p>}

      <div className="mt-6 overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-white/5 text-left text-white/50">
            <tr>
              <th className="px-4 py-3 font-medium">User</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">KYC</th>
              <th className="px-4 py-3 font-medium">Hold</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-white/5">
                <td className="px-4 py-3">
                  <div className="font-medium">{u.displayName || u.email || u.id}</div>
                  <div className="text-xs text-white/40">{u.email}</div>
                </td>
                <td className="px-4 py-3">
                  <Select
                    value={u.role}
                    options={ROLES}
                    disabled={!isAdmin}
                    onChange={(v) => patch(u.id, 'role', { role: v })}
                  />
                </td>
                <td className="px-4 py-3">
                  <Select
                    value={u.kycStatus}
                    options={KYCS}
                    onChange={(v) => patch(u.id, 'kyc', { status: v })}
                  />
                </td>
                <td className="px-4 py-3">
                  <Select
                    value={u.hold}
                    options={HOLDS}
                    onChange={(v) => patch(u.id, 'hold', { hold: v })}
                  />
                </td>
              </tr>
            ))}
            {!loading && users.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-white/40">
                  No users found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {!isAdmin && (
        <p className="mt-3 text-xs text-white/40">Role changes require an ADMIN account.</p>
      )}
    </div>
  );
}

function Select<T extends string>({
  value,
  options,
  disabled,
  onChange,
}: {
  value: T;
  options: T[];
  disabled?: boolean;
  onChange: (v: T) => void;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as T)}
      className="rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-sm outline-none focus:border-white/30 disabled:opacity-50"
    >
      {options.map((o) => (
        <option key={o} value={o} className="bg-booster-dark">
          {o}
        </option>
      ))}
    </select>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6 text-center text-white/70">
      {children}
    </div>
  );
}
