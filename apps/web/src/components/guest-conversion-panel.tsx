'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/i18n/language-context';
import { ArrowRightIcon, SparkleIcon } from './icons';

export function GuestConversionPanel({ messageKey = 'guest.subtitle' }: { messageKey?: string }) {
  const { login } = useAuth();
  const { t } = useI18n();

  return (
    <section className="mx-auto w-full max-w-lg rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-6 text-center shadow-2xl shadow-black/20">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-white text-black">
        <SparkleIcon />
      </span>
      <h1 className="mt-4 text-2xl font-bold tracking-tight">{t('guest.title')}</h1>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-white/60">{t(messageKey)}</p>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <button
          type="button"
          onClick={login}
          className="inline-flex h-11 items-center justify-center rounded-xl bg-white px-5 text-sm font-semibold text-black transition hover:bg-white/90"
        >
          {t('common.signUp')}
        </button>
        <Link
          href="/demo"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-5 text-sm font-semibold text-white/90 transition hover:bg-white/[0.08]"
        >
          {t('common.tryDemo')} <ArrowRightIcon className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}
