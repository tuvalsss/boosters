'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { usd } from '@/lib/api';
import type { TokenHolding, WalletData } from '@/lib/types';
import { useI18n } from '@/i18n/language-context';

export default function PortfolioPage() {
  const { ready, authenticated, login, apiFetch } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const [data, setData] = useState<WalletData | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      setData(await apiFetch<WalletData>('/wallet'));
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [apiFetch]);

  useEffect(() => {
    if (authenticated) void load();
  }, [authenticated, load]);

  if (!ready) return <Center>{t('common.loading')}</Center>;
  if (!authenticated) {
    return (
      <Center>
        <p className="mb-4 text-white/70">Sign in to view your portfolio.</p>
        <button
          onClick={login}
          className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black"
        >
          {t('common.login')}
        </button>
      </Center>
    );
  }

  const addFunds = async () => {
    const amount = window.prompt('Add funds - amount in USDC:', '100');
    if (!amount) return;
    try {
      const session = await apiFetch<{
        reference: string;
        provider: string;
        checkoutUrl: string;
      }>('/payments/onramp', {
        method: 'POST',
        body: JSON.stringify({ amountUsdc: amount }),
      });
      if (session.provider === 'sandbox') {
        router.push(`/payments/sandbox/${session.reference}?amount=${amount}`);
      } else {
        window.location.href = session.checkoutUrl;
      }
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const withdraw = async () => {
    const amountUsdc = window.prompt(t('portfolio.withdrawAmount'), '25');
    if (!amountUsdc) return;
    const destination = window.prompt(t('portfolio.withdrawDestination'));
    if (!destination) return;
    try {
      await apiFetch('/payments/withdrawals', {
        method: 'POST',
        body: JSON.stringify({
          amountUsdc,
          destinationType: 'USDC_WALLET',
          destination,
        }),
      });
      setErr(t('portfolio.withdrawRequested'));
      await load();
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 lg:px-8">
      <div className="flex items-end justify-between">
        <h1 className="text-3xl font-bold tracking-tight">{t('portfolio.title')}</h1>
        <div className="text-right">
          <p className="text-xs uppercase tracking-widest text-white/45">
            {t('portfolio.balance')}
          </p>
          <p className="text-2xl font-bold text-emerald-300">{usd(data?.balanceUsdc ?? '0')}</p>
          <div className="mt-1 flex justify-end gap-3">
            <button
              onClick={addFunds}
              className="text-xs font-medium text-white/60 underline hover:text-white"
            >
              + {t('portfolio.addFunds')}
            </button>
            <button
              onClick={withdraw}
              className="text-xs font-medium text-white/60 underline hover:text-white"
            >
              {t('portfolio.withdraw')}
            </button>
          </div>
        </div>
      </div>

      {err && <p className="mt-4 rounded-xl bg-red-500/10 px-4 py-2 text-sm text-red-300">{err}</p>}

      <h2 className="mb-3 mt-8 text-lg font-semibold">{t('portfolio.holdings')}</h2>
      {data && data.holdings.length === 0 ? (
        <p className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-8 text-center text-white/40">
          {t('portfolio.noCards')}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {data?.holdings.map((h) => (
            <HoldingCard key={h.id} holding={h} onListed={load} />
          ))}
        </div>
      )}

      <h2 className="mb-3 mt-10 text-lg font-semibold">{t('portfolio.history')}</h2>
      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full min-w-[520px] text-sm">
          <thead className="bg-white/5 text-left text-white/50">
            <tr>
              <th className="px-4 py-2 font-medium">Type</th>
              <th className="px-4 py-2 font-medium">Amount</th>
              <th className="px-4 py-2 font-medium">Fee</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Date</th>
            </tr>
          </thead>
          <tbody>
            {data?.orders.map((o) => (
              <tr key={o.id} className="border-t border-white/5">
                <td className="px-4 py-2">{o.type}</td>
                <td className="px-4 py-2">{usd(o.amountUsdc)}</td>
                <td className="px-4 py-2 text-white/50">{usd(o.feeUsdc)}</td>
                <td className="px-4 py-2">{o.status}</td>
                <td className="px-4 py-2 text-white/40">
                  {new Date(o.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
            {data && data.orders.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-white/40">
                  {t('portfolio.noTransactions')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function HoldingCard({ holding, onListed }: { holding: TokenHolding; onListed: () => void }) {
  const { apiFetch } = useAuth();
  const [price, setPrice] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [quote, setQuote] = useState<{ id: string; quoteUsdc: string } | null>(null);
  const card = holding.vaultItem.physicalCard;

  const list = async () => {
    setBusy(true);
    setErr(null);
    try {
      await apiFetch('/marketplace/listings', {
        method: 'POST',
        body: JSON.stringify({ vaultItemId: holding.vaultItem.id, priceUsdc: price }),
      });
      setPrice('');
      onListed();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const buyback = async () => {
    setBusy(true);
    setErr(null);
    try {
      const q = await apiFetch<{ id: string; quoteUsdc: string }>('/buyback/quote', {
        method: 'POST',
        body: JSON.stringify({ vaultItemId: holding.vaultItem.id }),
      });
      setQuote(q);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const accept = async () => {
    if (!quote) return;
    setBusy(true);
    setErr(null);
    try {
      await apiFetch(`/buyback/quotes/${quote.id}/accept`, { method: 'POST' });
      setQuote(null);
      onListed();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const redeemCard = async () => {
    const line1 = window.prompt('Shipping address (street):');
    if (!line1) return;
    const country = window.prompt('Country:', 'US') || 'US';
    setBusy(true);
    setErr(null);
    try {
      await apiFetch('/redeem', {
        method: 'POST',
        body: JSON.stringify({
          vaultItemId: holding.vaultItem.id,
          shippingAddress: { line1, country },
        }),
      });
      onListed();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
      <div className="relative h-24 w-[68px] shrink-0 overflow-hidden rounded-lg bg-black/30">
        {card.photos[0]?.url && (
          <Image src={card.photos[0].url} alt={card.cardName} fill className="object-cover" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{card.cardName}</p>
        <p className="text-xs text-white/45">
          {card.grader} {card.grade} · {holding.vaultItem.state}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="Price USDC"
            inputMode="decimal"
            className="h-8 w-24 rounded-lg border border-white/10 bg-black/30 px-2 text-sm outline-none focus:border-white/30"
          />
          <button
            onClick={list}
            disabled={busy || !price}
            className="h-8 rounded-lg bg-white px-3 text-sm font-semibold text-black disabled:opacity-50"
          >
            {busy ? '...' : 'List'}
          </button>
          <button
            onClick={buyback}
            disabled={busy}
            className="h-8 rounded-lg border border-white/15 px-3 text-sm hover:bg-white/5 disabled:opacity-50"
          >
            Sell to vault
          </button>
          <button
            onClick={redeemCard}
            disabled={busy}
            className="h-8 rounded-lg border border-white/15 px-3 text-sm hover:bg-white/5 disabled:opacity-50"
          >
            Redeem
          </button>
        </div>
        {quote && (
          <div className="mt-2 flex items-center gap-2 rounded-lg bg-white/5 px-2 py-1.5 text-xs">
            <span>
              Buyback offer:{' '}
              <span className="font-semibold text-emerald-300">{usd(quote.quoteUsdc)}</span>
            </span>
            <button
              onClick={accept}
              disabled={busy}
              className="rounded bg-emerald-400 px-2 py-0.5 font-semibold text-black disabled:opacity-50"
            >
              Accept
            </button>
            <span className="text-white/40">non-guaranteed</span>
          </div>
        )}
        {err && <p className="mt-1 text-xs text-red-300">{err}</p>}
      </div>
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
