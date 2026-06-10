'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { usd } from '@/lib/api';
import type {
  KycDocumentType,
  KycIdentityDocumentType,
  KycStatus,
  KycStatusResponse,
  WalletData,
} from '@/lib/types';
import { useI18n } from '@/i18n/language-context';
import { GuestConversionPanel } from '@/components/guest-conversion-panel';

const KYC_LABEL: Record<KycStatus, string> = {
  NONE: 'kyc.notStarted',
  PENDING: 'kyc.pending',
  APPROVED: 'kyc.approved',
  REJECTED: 'kyc.rejected',
};

const DOCUMENT_TYPES: { value: KycIdentityDocumentType; labelKey: string }[] = [
  { value: 'ID_CARD', labelKey: 'kyc.idCard' },
  { value: 'DRIVERS_LICENSE', labelKey: 'kyc.driversLicense' },
  { value: 'PASSPORT', labelKey: 'kyc.passport' },
];
const ACCOUNT_ACTIONS = [
  { label: 'Portfolio', href: '/portfolio' },
  { label: 'Open packs', href: '/packs' },
  { label: 'Marketplace', href: '/marketplace' },
  { label: 'Submit card', href: '/submit' },
];

export default function AccountPage() {
  const { ready, authenticated, dbUser, refreshMe, apiFetch } = useAuth();
  const { t } = useI18n();
  const [displayName, setDisplayName] = useState('');
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    setDisplayName(dbUser?.displayName ?? '');
  }, [dbUser?.displayName]);

  useEffect(() => {
    if (!authenticated) return;
    apiFetch<WalletData>('/wallet')
      .then(setWallet)
      .catch(() => setWallet(null));
  }, [apiFetch, authenticated]);

  if (!ready) return <Centered>{t('common.loading')}</Centered>;
  if (!authenticated || !dbUser) {
    return (
      <Centered>
        <GuestConversionPanel messageKey="guest.account" />
      </Centered>
    );
  }

  const saveProfile = async () => {
    setSaving(true);
    setMsg(null);
    try {
      await apiFetch('/me', { method: 'PATCH', body: JSON.stringify({ displayName }) });
      await refreshMe();
      setMsg(t('account.profileSaved'));
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 lg:px-8">
      <h1 className="text-3xl font-bold tracking-tight">{t('account.title')}</h1>

      <section className="mt-6 grid gap-3 sm:grid-cols-3">
        <ProfileStat label={t('portfolio.balance')} value={usd(wallet?.balanceUsdc ?? '0')} />
        <ProfileStat label={t('portfolio.holdings')} value={String(wallet?.holdings.length ?? 0)} />
        <ProfileStat label={t('portfolio.history')} value={String(wallet?.orders.length ?? 0)} />
      </section>

      <section className="mt-3 grid gap-3 sm:grid-cols-4">
        {ACCOUNT_ACTIONS.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="rounded-xl border border-white/10 bg-white/[0.035] px-3 py-3 text-sm font-semibold text-white/75 transition hover:border-white/20 hover:bg-white/[0.06]"
          >
            {action.label}
          </Link>
        ))}
      </section>

      <section className="mt-6 space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <Field label={t('account.email')} value={dbUser.email ?? '-'} />
        <Field label={t('account.wallet')} value={dbUser.walletAddress ?? 'Not linked'} mono />
        <Field label={t('account.role')} value={dbUser.role} />
        <Field
          label={t('account.accountStatus')}
          value={dbUser.hold === 'NONE' ? t('common.active') : dbUser.hold}
        />

        <div>
          <label className="mb-1 block text-sm text-white/60" htmlFor="displayName">
            {t('account.displayName')}
          </label>
          <div className="flex gap-2">
            <input
              id="displayName"
              value={displayName}
              maxLength={60}
              onChange={(e) => setDisplayName(e.target.value)}
              className="flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-white/30"
              placeholder={t('account.displayPlaceholder')}
            />
            <button
              onClick={saveProfile}
              disabled={saving}
              className="rounded-xl bg-white px-4 text-sm font-semibold text-black disabled:opacity-60"
            >
              {saving ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </div>
      </section>

      <KycPanel />

      {msg && <p className="mt-4 rounded-xl bg-white/5 px-4 py-3 text-sm text-white/80">{msg}</p>}
    </div>
  );
}

function ProfileStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-xs uppercase tracking-widest text-white/35">{label}</p>
      <p className="mt-2 text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

function KycPanel() {
  const { dbUser, refreshMe, apiFetch } = useAuth();
  const { t } = useI18n();
  const [kyc, setKyc] = useState<KycStatusResponse | null>(null);
  const [documentType, setDocumentType] = useState<KycIdentityDocumentType>('ID_CARD');
  const [legalName, setLegalName] = useState('');
  const [country, setCountry] = useState('US');
  const [notes, setNotes] = useState('');
  const [files, setFiles] = useState<Partial<Record<KycDocumentType, File>>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setKyc(await apiFetch<KycStatusResponse>('/kyc/status'));
  }, [apiFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  const status = kyc?.status ?? dbUser?.kycStatus ?? 'NONE';
  const canSubmit = status === 'NONE' || status === 'REJECTED';
  const requirements = useMemo(() => requiredFields(documentType), [documentType]);

  const submit = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const missing = requirements.filter((r) => r.required && !files[r.type]);
      if (missing.length > 0) {
        throw new Error(`Missing: ${missing.map((m) => t(m.labelKey)).join(', ')}`);
      }
      const documents = [];
      for (const req of requirements) {
        const file = files[req.type];
        if (!file) continue;
        documents.push({
          type: req.type,
          fileName: file.name,
          contentType: file.type,
          dataUrl: await readAsDataUrl(file),
        });
      }
      await apiFetch('/kyc/manual', {
        method: 'POST',
        body: JSON.stringify({
          documentType,
          legalName,
          country,
          notes: notes || undefined,
          documents,
        }),
      });
      setFiles({});
      setNotes('');
      setMsg(t('kyc.submitted'));
      await refreshMe();
      await load();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">{t('kyc.title')}</h2>
          <p className="text-sm text-white/55">
            {t('common.status')}: <span className="text-white">{t(KYC_LABEL[status])}</span>
          </p>
          <p className="mt-2 max-w-xl text-xs text-white/45">{t('kyc.subtitle')}</p>
        </div>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/60">
          {t('kyc.withdrawalGate')}
        </span>
      </div>

      {kyc?.submission && (
        <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-white/55">
          <p>
            {kyc.submission.legalName} · {kyc.submission.country} ·{' '}
            {new Date(kyc.submission.createdAt).toLocaleString()}
          </p>
          <p className="mt-1">
            {kyc.submission.documents.length} {t('admin.documents').toLowerCase()}
          </p>
          {kyc.submission.reviewerNotes && (
            <p className="mt-2 text-white/70">{kyc.submission.reviewerNotes}</p>
          )}
        </div>
      )}

      {canSubmit && (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <input
            value={legalName}
            onChange={(e) => setLegalName(e.target.value)}
            placeholder={t('kyc.legalName')}
            className="h-10 rounded-xl border border-white/10 bg-black/30 px-3 text-sm outline-none focus:border-white/30"
          />
          <input
            value={country}
            maxLength={2}
            onChange={(e) => setCountry(e.target.value.toUpperCase())}
            placeholder={t('kyc.country')}
            className="h-10 rounded-xl border border-white/10 bg-black/30 px-3 text-sm uppercase outline-none focus:border-white/30"
          />
          <select
            value={documentType}
            onChange={(e) => {
              setDocumentType(e.target.value as KycIdentityDocumentType);
              setFiles({});
            }}
            className="h-10 rounded-xl border border-white/10 bg-black/30 px-3 text-sm outline-none focus:border-white/30"
          >
            {DOCUMENT_TYPES.map((d) => (
              <option key={d.value} value={d.value} className="bg-booster-dark">
                {t(d.labelKey)}
              </option>
            ))}
          </select>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t('kyc.notes')}
            className="h-10 rounded-xl border border-white/10 bg-black/30 px-3 text-sm outline-none focus:border-white/30"
          />

          <div className="sm:col-span-2 grid gap-3 sm:grid-cols-2">
            {requirements.map((req) => (
              <FileField
                key={req.type}
                label={`${t(req.labelKey)}${req.required ? '' : ' (optional)'}`}
                onChange={(file) => setFiles((current) => ({ ...current, [req.type]: file }))}
              />
            ))}
          </div>

          <p className="text-xs text-white/40 sm:col-span-2">{t('kyc.uploadHint')}</p>
          <button
            onClick={submit}
            disabled={busy || !legalName || country.length !== 2}
            className="h-11 rounded-xl bg-white px-4 text-sm font-semibold text-black disabled:opacity-50 sm:col-span-2"
          >
            {busy ? t('common.saving') : t('kyc.submit')}
          </button>
        </div>
      )}

      {msg && <p className="mt-4 rounded-xl bg-white/5 px-4 py-3 text-sm text-white/80">{msg}</p>}
    </section>
  );
}

function requiredFields(documentType: KycIdentityDocumentType) {
  if (documentType === 'PASSPORT') {
    return [
      { type: 'PASSPORT' as const, labelKey: 'kyc.passport', required: true },
      { type: 'SELFIE' as const, labelKey: 'kyc.selfie', required: true },
      { type: 'PROOF_OF_ADDRESS' as const, labelKey: 'kyc.proofAddress', required: false },
    ];
  }
  if (documentType === 'DRIVERS_LICENSE') {
    return [
      { type: 'DRIVERS_LICENSE_FRONT' as const, labelKey: 'kyc.front', required: true },
      { type: 'DRIVERS_LICENSE_BACK' as const, labelKey: 'kyc.back', required: true },
      { type: 'SELFIE' as const, labelKey: 'kyc.selfie', required: true },
      { type: 'PROOF_OF_ADDRESS' as const, labelKey: 'kyc.proofAddress', required: false },
    ];
  }
  return [
    { type: 'ID_FRONT' as const, labelKey: 'kyc.front', required: true },
    { type: 'ID_BACK' as const, labelKey: 'kyc.back', required: true },
    { type: 'SELFIE' as const, labelKey: 'kyc.selfie', required: true },
    { type: 'PROOF_OF_ADDRESS' as const, labelKey: 'kyc.proofAddress', required: false },
  ];
}

function FileField({ label, onChange }: { label: string; onChange: (file: File) => void }) {
  return (
    <label className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white/70">
      <span className="block pb-2">{label}</span>
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onChange(file);
        }}
        className="block w-full text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-black"
      />
    </label>
  );
}

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
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
