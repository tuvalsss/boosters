'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import { publicFetch, usd } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import type { ListingRow } from '@/lib/types';

export default function ListingPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { authenticated, login, apiFetch, dbUser, refreshMe } = useAuth();
  const [listing, setListing] = useState<ListingRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setListing(await publicFetch<ListingRow>(`/marketplace/listings/${id}`));
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (err) return <Center>{err}</Center>;
  if (!listing) return <Center>Loading…</Center>;

  const card = listing.vaultItem.physicalCard;
  const isOwn = dbUser?.id === listing.seller.id;
  const sold = listing.status !== 'ACTIVE';

  const buy = async () => {
    if (!authenticated) return login();
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      await apiFetch(`/marketplace/listings/${listing.id}/buy`, {
        method: 'POST',
        body: JSON.stringify({ idempotencyKey: crypto.randomUUID() }),
      });
      await refreshMe();
      setMsg('Purchased! The card is now in your portfolio.');
      setTimeout(() => router.push('/portfolio'), 900);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-8 px-4 py-10 sm:grid-cols-2 lg:px-8">
      <div className="relative aspect-[5/7] overflow-hidden rounded-2xl border border-white/10 bg-black/30">
        {card.photos[0]?.url ? (
          <Image src={card.photos[0].url} alt={card.cardName} fill className="object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-white/30">No image</div>
        )}
      </div>

      <div>
        <span className="text-xs uppercase tracking-widest text-white/45">
          {listing.type === 'FIRST_PARTY' ? 'Official listing' : 'Peer-to-peer'}
        </span>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">{card.cardName}</h1>
        <p className="mt-1 text-white/60">
          {card.category} · {card.grader} {card.grade} {card.setName ? `· ${card.setName}` : ''}
        </p>

        <p className="mt-6 text-4xl font-bold text-emerald-300">{usd(listing.priceUsdc)}</p>
        <p className="mt-1 text-xs text-white/40">
          Settled in USDC · 2% fee included for the seller.
        </p>

        <div className="mt-7">
          {sold ? (
            <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/60">
              This listing is {listing.status.toLowerCase()}.
            </div>
          ) : isOwn ? (
            <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/60">
              This is your listing.
            </div>
          ) : (
            <button
              onClick={buy}
              disabled={busy}
              className="w-full rounded-full bg-white py-3.5 text-sm font-semibold text-black hover:bg-white/90 disabled:opacity-60 sm:w-auto sm:px-10"
            >
              {busy ? 'Processing…' : authenticated ? 'Buy now' : 'Login to buy'}
            </button>
          )}
        </div>

        {msg && <p className="mt-4 text-sm text-emerald-300">{msg}</p>}
        {err && <p className="mt-4 text-sm text-red-300">{err}</p>}

        {listing.vaultItem.token && (
          <p className="mt-8 break-all font-mono text-[11px] text-white/30">
            cNFT {listing.vaultItem.token.cnftAssetId}
          </p>
        )}
      </div>
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6 text-center text-white/70">
      {children}
    </div>
  );
}
