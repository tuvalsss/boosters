'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { isStaff, type KycStatus, type KycSubmission } from '@/lib/types';
import { useI18n } from '@/i18n/language-context';

const FILTERS: (KycStatus | 'ALL')[] = ['PENDING', 'APPROVED', 'REJECTED', 'ALL'];

export default function AdminKycPage() {
  const { ready, authenticated, dbUser, apiFetch } = useAuth();
  const { t } = useI18n();
  const [items, setItems] = useState<KycSubmission[]>([]);
  const [filter, setFilter] = useState<KycStatus | 'ALL'>('PENDING');
  const [err, setErr] = useState<string | null>(null);
  const staff = isStaff(dbUser?.role);

  const load = useCallback(async () => {
    setErr(null);
    try {
      setItems(await apiFetch<KycSubmission[]>(`/admin/kyc?status=${filter}`));
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [apiFetch, filter]);

  useEffect(() => {
    if (staff) void load();
  }, [staff, load]);

  if (!ready) return <Note>{t('common.loading')}</Note>;
  if (!authenticated || !staff) return <Note>Staff access required.</Note>;

  const review = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    const reviewerNotes = window.prompt(t('admin.reviewNotes'), '');
    try {
      await apiFetch(`/admin/kyc/${id}/review`, {
        method: 'PATCH',
        body: JSON.stringify({ status, reviewerNotes: reviewerNotes || undefined }),
      });
      await load();
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('admin.kycQueue')}</h1>
          <p className="text-sm text-white/55">{t('kyc.subtitle')}</p>
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as KycStatus | 'ALL')}
          className="h-10 rounded-xl border border-white/10 bg-black/30 px-3 text-sm outline-none focus:border-white/30"
        >
          {FILTERS.map((f) => (
            <option key={f} value={f} className="bg-booster-dark">
              {f === 'ALL' ? t('common.all') : f}
            </option>
          ))}
        </select>
      </div>

      {err && <p className="mt-4 rounded-xl bg-red-500/10 px-4 py-2 text-sm text-red-300">{err}</p>}

      <div className="mt-6 space-y-4">
        {items.map((submission) => (
          <article
            key={submission.id}
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold">{submission.legalName}</h2>
                  <span className={statusClass(submission.status)}>{submission.status}</span>
                </div>
                <p className="mt-1 text-sm text-white/50">
                  {submission.user?.email ?? submission.userId} · {submission.country} ·{' '}
                  {submission.documentType}
                </p>
                <p className="text-xs text-white/35">
                  {new Date(submission.createdAt).toLocaleString()}
                </p>
              </div>
              {submission.status === 'PENDING' && (
                <div className="flex gap-2">
                  <button
                    onClick={() => review(submission.id, 'APPROVED')}
                    className="h-9 rounded-lg bg-emerald-400 px-3 text-sm font-semibold text-black"
                  >
                    {t('common.approve')}
                  </button>
                  <button
                    onClick={() => review(submission.id, 'REJECTED')}
                    className="h-9 rounded-lg border border-red-400/40 px-3 text-sm text-red-200 hover:bg-red-500/10"
                  >
                    {t('common.reject')}
                  </button>
                </div>
              )}
            </div>

            {submission.notes && <p className="mt-3 text-sm text-white/60">{submission.notes}</p>}
            {submission.reviewerNotes && (
              <p className="mt-3 rounded-xl bg-white/5 px-3 py-2 text-sm text-white/70">
                {submission.reviewerNotes}
              </p>
            )}

            <h3 className="mt-4 text-xs font-semibold uppercase tracking-widest text-white/40">
              {t('admin.documents')}
            </h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {submission.documents.map((doc) => (
                <DocumentPreview
                  key={doc.id}
                  id={doc.id}
                  label={`${doc.type} · ${doc.fileName}`}
                  contentType={doc.contentType}
                />
              ))}
            </div>
          </article>
        ))}
        {items.length === 0 && (
          <p className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-10 text-center text-white/40">
            {t('admin.noKyc')}
          </p>
        )}
      </div>
    </div>
  );
}

function DocumentPreview({
  id,
  label,
  contentType,
}: {
  id: string;
  label: string;
  contentType: string;
}) {
  const { apiRawFetch } = useAuth();
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let currentUrl: string | null = null;
    apiRawFetch(`/kyc/documents/${id}`)
      .then((res) => res.blob())
      .then((blob) => {
        currentUrl = URL.createObjectURL(blob);
        setUrl(currentUrl);
      })
      .catch((e) => setErr((e as Error).message));
    return () => {
      if (currentUrl) URL.revokeObjectURL(currentUrl);
    };
  }, [apiRawFetch, id]);

  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-black/20">
      <div className="flex h-44 items-center justify-center bg-black/30">
        {!url && !err && <span className="text-xs text-white/35">Loading document...</span>}
        {err && <span className="px-3 text-center text-xs text-red-300">{err}</span>}
        {url && contentType.startsWith('image/') && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={label} className="h-full w-full object-contain" />
        )}
        {url && !contentType.startsWith('image/') && (
          <a href={url} target="_blank" rel="noreferrer" className="text-sm text-white underline">
            Open document
          </a>
        )}
      </div>
      <p className="truncate px-3 py-2 text-xs text-white/55" title={label}>
        {label}
      </p>
    </div>
  );
}

function statusClass(status: KycStatus) {
  const base = 'rounded-full px-2 py-0.5 text-[11px] font-semibold';
  if (status === 'APPROVED') return `${base} bg-emerald-500/20 text-emerald-300`;
  if (status === 'REJECTED') return `${base} bg-red-500/20 text-red-300`;
  if (status === 'PENDING') return `${base} bg-amber-500/20 text-amber-300`;
  return `${base} bg-white/10 text-white/60`;
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6 text-center text-white/70">
      {children}
    </div>
  );
}
