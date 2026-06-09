'use client';

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { isStaff, type EbayCardListing, type VaultItemRow, type VaultState } from '@/lib/types';

const LEGACY_CATEGORIES = ['POKEMON', 'SPORTS', 'TCG', 'OTHER'] as const;
const GRADERS = ['PSA', 'BGS', 'CGC', 'SGC', 'RAW', 'OTHER'] as const;

const STATE_STYLES: Record<VaultState, string> = {
  INTAKE: 'bg-white/10 text-white/70',
  AUTHENTICATING: 'bg-amber-500/20 text-amber-300',
  GRADED: 'bg-blue-500/20 text-blue-300',
  VAULTED: 'bg-emerald-500/20 text-emerald-300',
  RESERVED: 'bg-purple-500/20 text-purple-300',
  RELEASED: 'bg-white/5 text-white/40',
};

interface ManagedCategory {
  id: string;
  slug: string;
  name: string;
  legacyCategory: string;
  description: string | null;
  imageUrl: string | null;
  accentColor: string;
  active: boolean;
  sortOrder: number;
}

type CardPhotoInput = { url: string; kind: string };

export default function VaultAdminPage() {
  const { ready, authenticated, dbUser, apiFetch } = useAuth();
  const [items, setItems] = useState<VaultItemRow[]>([]);
  const [categories, setCategories] = useState<ManagedCategory[]>([]);
  const [ebayListings, setEbayListings] = useState<EbayCardListing[]>([]);
  const [filter, setFilter] = useState<VaultState | ''>('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const staff = isStaff(dbUser?.role);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const q = filter ? `?state=${filter}` : '';
      const [vault, cats, ebay] = await Promise.all([
        apiFetch<{ items: VaultItemRow[]; total: number }>(`/admin/vault/items${q}`),
        apiFetch<ManagedCategory[]>('/admin/vault/card-categories'),
        apiFetch<EbayCardListing[]>('/admin/vault/ebay-listings?take=12'),
      ]);
      setItems(vault.items);
      setCategories(cats);
      setEbayListings(ebay);
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [apiFetch, filter]);

  useEffect(() => {
    if (staff) void load();
  }, [staff, load]);

  if (!ready) return <Note>Loading...</Note>;
  if (!authenticated || !staff) return <Note>Staff access required.</Note>;

  const mutate = async (method: 'POST' | 'PATCH', path: string, body?: object) => {
    setBusy(path);
    setErr(null);
    try {
      await apiFetch(`/admin/vault/${path}`, {
        method,
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
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Vault / Cards</h1>
          <p className="text-sm text-white/55">
            Manage card categories, intake, images, grading and the custody gate before packs use
            the inventory.
          </p>
        </div>
      </div>

      <CategoryManager
        categories={categories}
        busy={busy}
        onCreate={(dto) => mutate('POST', 'card-categories', dto)}
        onUpdate={(id, dto) => mutate('PATCH', `card-categories/${id}`, dto)}
      />

      <IntakeForm
        categories={categories}
        onCreate={(dto) => mutate('POST', 'intake', dto)}
        busy={busy === 'intake'}
      />

      <EbaySourcingPanel
        listings={ebayListings}
        busy={busy}
        onCreateIntake={(id) => mutate('POST', `ebay-listings/${id}/intake`)}
      />

      <div className="mt-8 flex flex-wrap items-center gap-2">
        <span className="text-sm text-white/50">Filter:</span>
        {(['', 'INTAKE', 'AUTHENTICATING', 'GRADED', 'VAULTED'] as const).map((s) => (
          <button
            key={s || 'all'}
            onClick={() => setFilter(s)}
            className={`rounded-full px-3 py-1 text-xs ${
              filter === s ? 'bg-white text-black' : 'bg-white/10 text-white/70'
            }`}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      {err && <p className="mt-4 rounded-xl bg-red-500/10 px-4 py-2 text-sm text-red-300">{err}</p>}

      <div className="mt-4 space-y-3">
        {items.map((it) => (
          <VaultRow key={it.id} item={it} categories={categories} busy={busy} onMutate={mutate} />
        ))}
        {items.length === 0 && <p className="py-8 text-center text-white/40">No items.</p>}
      </div>
    </div>
  );
}

function EbaySourcingPanel({
  listings,
  busy,
  onCreateIntake,
}: {
  listings: EbayCardListing[];
  busy: string | null;
  onCreateIntake: (id: string) => void;
}) {
  return (
    <section className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-lg font-semibold">eBay sourcing</h2>
          <p className="text-sm text-white/50">
            Official Browse API listings. Import candidates, then create intake before any card can
            enter packs.
          </p>
        </div>
        <code className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-white/60">
          pnpm ebay:import-cards -- --limit 100
        </code>
      </div>

      {listings.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-white/15 px-4 py-6 text-center text-sm text-white/45">
          No eBay listings imported yet. Add the eBay env vars and run the import command.
        </p>
      ) : (
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          {listings.map((listing) => (
            <article
              key={listing.id}
              className="grid grid-cols-[5.2rem_1fr] gap-3 rounded-xl border border-white/10 bg-black/25 p-3"
            >
              <a
                href={listing.itemAffiliateWebUrl ?? listing.itemWebUrl}
                target="_blank"
                rel="noreferrer"
                className="relative h-28 overflow-hidden rounded-lg bg-white/5"
              >
                <Image
                  src={listing.imageUrl}
                  alt={listing.cardName}
                  fill
                  className="object-cover"
                  sizes="84px"
                />
              </a>
              <div className="min-w-0">
                <div className="flex flex-wrap gap-1">
                  <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-200">
                    {listing.tier}
                  </span>
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/55">
                    {listing.status}
                  </span>
                </div>
                <p className="mt-2 line-clamp-2 text-sm font-semibold">{listing.cardName}</p>
                <p className="mt-1 truncate text-xs text-white/45">
                  {listing.grader} {listing.grade ?? ''} / {listing.condition ?? listing.category}
                </p>
                <p className="mt-1 text-xs font-semibold text-emerald-200">
                  {listing.priceCurrency} {Number(listing.priceValue).toLocaleString()}
                </p>
                <p className="mt-1 truncate text-[11px] text-white/35">
                  {listing.sellerUsername ?? 'seller'}{' '}
                  {listing.sellerFeedbackPercentage ? `/ ${listing.sellerFeedbackPercentage}%` : ''}
                </p>
                <button
                  type="button"
                  onClick={() => onCreateIntake(listing.id)}
                  disabled={busy === `ebay-listings/${listing.id}/intake`}
                  className="mt-3 h-8 rounded-lg bg-white px-3 text-xs font-semibold text-black transition hover:bg-white/90 disabled:opacity-50"
                >
                  Create intake
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function CategoryManager({
  categories,
  busy,
  onCreate,
  onUpdate,
}: {
  categories: ManagedCategory[];
  busy: string | null;
  onCreate: (dto: object) => void;
  onUpdate: (id: string, dto: object) => void;
}) {
  const [form, setForm] = useState({
    name: 'Pokemon Packs',
    slug: 'pokemon',
    legacyCategory: 'POKEMON',
    description: 'Licensed TCG inventory category.',
    imageUrl: '/assets/brand-packs/creature-front.svg',
    accentColor: '#2563eb',
    sortOrder: '10',
    active: true,
  });

  const dto = {
    ...form,
    sortOrder: Number(form.sortOrder) || 0,
  };

  return (
    <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-lg font-bold">Card categories</h2>
          <p className="text-sm text-white/50">
            Create operational categories with a public label, image and color.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onCreate(dto)}
          disabled={busy === 'card-categories'}
          className="h-10 rounded-lg bg-white px-4 text-sm font-semibold text-black disabled:opacity-60"
        >
          Add category
        </button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <Field label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
        <Field label="Slug" value={form.slug} onChange={(v) => setForm({ ...form, slug: v })} />
        <Select
          value={form.legacyCategory}
          options={LEGACY_CATEGORIES}
          onChange={(v) => setForm({ ...form, legacyCategory: v })}
        />
        <Field
          label="Color"
          value={form.accentColor}
          onChange={(v) => setForm({ ...form, accentColor: v })}
        />
        <Field
          label="Image URL"
          value={form.imageUrl}
          onChange={(v) => setForm({ ...form, imageUrl: v })}
        />
        <Field
          label="Sort"
          value={form.sortOrder}
          onChange={(v) => setForm({ ...form, sortOrder: v })}
        />
        <Field
          label="Description"
          value={form.description}
          onChange={(v) => setForm({ ...form, description: v })}
          span
        />
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {categories.map((cat) => (
          <div
            key={cat.id}
            className="grid grid-cols-[4rem_1fr_auto] items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-3"
          >
            <div
              className="relative h-16 w-16 overflow-hidden rounded-lg border border-white/10"
              style={{ background: `linear-gradient(145deg, ${cat.accentColor}55, transparent)` }}
            >
              {cat.imageUrl && (
                <Image src={cat.imageUrl} alt="" fill className="object-contain p-1" />
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{cat.name}</p>
              <p className="text-xs text-white/45">
                {cat.slug} / {cat.legacyCategory} / {cat.active ? 'active' : 'hidden'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onUpdate(cat.id, { ...cat, active: !cat.active })}
              className="h-9 rounded-lg border border-white/15 px-3 text-xs hover:bg-white/5"
            >
              {cat.active ? 'Hide' : 'Show'}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

function VaultRow({
  item,
  categories,
  busy,
  onMutate,
}: {
  item: VaultItemRow;
  categories: ManagedCategory[];
  busy: string | null;
  onMutate: (method: 'POST' | 'PATCH', path: string, body?: object) => void;
}) {
  const [grade, setGrade] = useState('');
  const [editing, setEditing] = useState(false);
  const c = item.physicalCard;
  const firstPhoto = c.photos?.[0]?.url;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid min-w-0 grid-cols-[4.5rem_1fr] items-center gap-3">
          <div className="relative h-20 w-16 overflow-hidden rounded-xl border border-white/10 bg-black/30">
            {firstPhoto ? (
              <Image src={firstPhoto} alt="" fill className="object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-[10px] text-white/30">
                No image
              </div>
            )}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate font-semibold">{c.cardName}</span>
              <span className={`rounded-full px-2 py-0.5 text-[11px] ${STATE_STYLES[item.state]}`}>
                {item.state}
              </span>
            </div>
            <div className="text-xs text-white/45">
              {c.category} / {c.grader} {c.grade ?? ''} {c.certNumber ? `/ #${c.certNumber}` : ''}
            </div>
            <div className="text-xs text-white/35">
              owner: {item.owner.email ?? item.owner.id}
              {!item.owner.walletAddress && ' / no wallet'}
            </div>
            {item.token && (
              <div className="mt-1 break-all font-mono text-[11px] text-emerald-300/80">
                cNFT {item.token.cnftAssetId}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Btn onClick={() => setEditing((v) => !v)}>{editing ? 'Close edit' : 'Edit card'}</Btn>
          {item.state === 'INTAKE' && (
            <Btn
              busy={busy === `items/${item.id}/authenticate`}
              onClick={() => onMutate('POST', `items/${item.id}/authenticate`)}
            >
              Start authentication
            </Btn>
          )}
          {item.state === 'AUTHENTICATING' && (
            <>
              <input
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                placeholder="Grade"
                className="h-9 w-28 rounded-lg border border-white/10 bg-black/30 px-2 text-sm outline-none focus:border-white/30"
              />
              <Btn
                busy={busy === `items/${item.id}/grade`}
                disabled={!grade}
                onClick={() => onMutate('POST', `items/${item.id}/grade`, { grade })}
              >
                Set grade
              </Btn>
            </>
          )}
          {item.state === 'GRADED' && (
            <Btn
              primary
              busy={busy === `items/${item.id}/vault`}
              onClick={() => onMutate('POST', `items/${item.id}/vault`)}
            >
              Vault & mint cNFT
            </Btn>
          )}
        </div>
      </div>

      {editing && (
        <CardEditForm
          item={item}
          categories={categories}
          busy={busy === `items/${item.id}/card`}
          onSave={(dto) => onMutate('PATCH', `items/${item.id}/card`, dto)}
        />
      )}
    </div>
  );
}

function IntakeForm({
  categories,
  onCreate,
  busy,
}: {
  categories: ManagedCategory[];
  onCreate: (dto: object) => void;
  busy: boolean;
}) {
  const activeCategories = useMemo(() => categories.filter((c) => c.active), [categories]);
  const defaultCategory = activeCategories[0]?.legacyCategory ?? 'POKEMON';
  const [form, setForm] = useState({
    category: defaultCategory,
    grader: 'PSA',
    cardName: '',
    setName: '',
    year: '',
    certNumber: '',
    grade: '',
    frontUrl: '',
    backUrl: '',
  });

  useEffect(() => {
    setForm((f) => ({ ...f, category: defaultCategory }));
  }, [defaultCategory]);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!form.cardName) return;
        const photos: CardPhotoInput[] = [
          form.frontUrl ? { url: form.frontUrl, kind: 'front' } : null,
          form.backUrl ? { url: form.backUrl, kind: 'back' } : null,
        ].filter(Boolean) as CardPhotoInput[];
        onCreate({
          category: form.category,
          grader: form.grader,
          cardName: form.cardName,
          setName: form.setName || undefined,
          year: form.year ? Number(form.year) : undefined,
          certNumber: form.certNumber || undefined,
          grade: form.grade || undefined,
          photos,
        });
        setForm((f) => ({ ...f, cardName: '', setName: '', certNumber: '', grade: '' }));
      }}
      className="mt-6 grid gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:grid-cols-6"
    >
      <Select
        value={form.category}
        options={
          (activeCategories.length
            ? activeCategories.map((c) => c.legacyCategory)
            : LEGACY_CATEGORIES) as readonly string[]
        }
        onChange={(v) => set('category', v)}
      />
      <Select value={form.grader} options={GRADERS} onChange={(v) => set('grader', v)} />
      <Field label="Card name" value={form.cardName} onChange={(v) => set('cardName', v)} span />
      <Field label="Set" value={form.setName} onChange={(v) => set('setName', v)} />
      <Field label="Year" value={form.year} onChange={(v) => set('year', v)} />
      <Field label="Cert #" value={form.certNumber} onChange={(v) => set('certNumber', v)} />
      <Field label="Grade" value={form.grade} onChange={(v) => set('grade', v)} />
      <Field
        label="Front image URL"
        value={form.frontUrl}
        onChange={(v) => set('frontUrl', v)}
        span
      />
      <Field label="Back image URL" value={form.backUrl} onChange={(v) => set('backUrl', v)} span />
      <button
        type="submit"
        disabled={busy || !form.cardName}
        className="h-10 rounded-lg bg-white px-4 text-sm font-semibold text-black disabled:opacity-60 sm:col-span-6"
      >
        {busy ? 'Adding...' : 'Add intake'}
      </button>
    </form>
  );
}

function CardEditForm({
  item,
  categories,
  busy,
  onSave,
}: {
  item: VaultItemRow;
  categories: ManagedCategory[];
  busy: boolean;
  onSave: (dto: object) => void;
}) {
  const c = item.physicalCard;
  const [form, setForm] = useState({
    category: c.category,
    grader: c.grader,
    cardName: c.cardName,
    setName: c.setName ?? '',
    year: c.year ? String(c.year) : '',
    certNumber: c.certNumber ?? '',
    grade: c.grade ?? '',
    frontUrl: c.photos?.find((p) => p.kind === 'front')?.url ?? c.photos?.[0]?.url ?? '',
    backUrl: c.photos?.find((p) => p.kind === 'back')?.url ?? '',
  });
  const activeCategories = categories.filter((cat) => cat.active);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="mt-4 grid gap-3 rounded-xl border border-white/10 bg-black/20 p-3 sm:grid-cols-6">
      <Select
        value={form.category}
        options={
          (activeCategories.length
            ? activeCategories.map((cat) => cat.legacyCategory)
            : LEGACY_CATEGORIES) as readonly string[]
        }
        onChange={(v) => set('category', v)}
      />
      <Select value={form.grader} options={GRADERS} onChange={(v) => set('grader', v)} />
      <Field label="Card name" value={form.cardName} onChange={(v) => set('cardName', v)} span />
      <Field label="Set" value={form.setName} onChange={(v) => set('setName', v)} />
      <Field label="Year" value={form.year} onChange={(v) => set('year', v)} />
      <Field label="Cert #" value={form.certNumber} onChange={(v) => set('certNumber', v)} />
      <Field label="Grade" value={form.grade} onChange={(v) => set('grade', v)} />
      <Field
        label="Front image URL"
        value={form.frontUrl}
        onChange={(v) => set('frontUrl', v)}
        span
      />
      <Field label="Back image URL" value={form.backUrl} onChange={(v) => set('backUrl', v)} span />
      <button
        type="button"
        disabled={busy || !form.cardName}
        onClick={() => {
          const photos: CardPhotoInput[] = [
            form.frontUrl ? { url: form.frontUrl, kind: 'front' } : null,
            form.backUrl ? { url: form.backUrl, kind: 'back' } : null,
          ].filter(Boolean) as CardPhotoInput[];
          onSave({
            category: form.category,
            grader: form.grader,
            cardName: form.cardName,
            setName: form.setName,
            year: form.year ? Number(form.year) : undefined,
            certNumber: form.certNumber,
            grade: form.grade,
            photos,
          });
        }}
        className="h-10 rounded-lg bg-emerald-300 px-4 text-sm font-bold text-black disabled:opacity-60 sm:col-span-6"
      >
        {busy ? 'Saving...' : 'Save card'}
      </button>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  span,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  span?: boolean;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={label}
      className={`h-10 rounded-lg border border-white/10 bg-black/30 px-3 text-sm outline-none focus:border-white/30 ${
        span ? 'sm:col-span-2' : ''
      }`}
    />
  );
}

function Select({
  value,
  options,
  onChange,
}: {
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-10 rounded-lg border border-white/10 bg-black/40 px-2 text-sm"
    >
      {[...new Set(options)].map((opt) => (
        <option key={opt} value={opt} className="bg-booster-dark">
          {opt}
        </option>
      ))}
    </select>
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
      type="button"
      onClick={onClick}
      disabled={busy || disabled}
      className={`h-9 rounded-lg px-3 text-sm font-medium disabled:opacity-50 ${
        primary
          ? 'bg-emerald-400 text-black hover:bg-emerald-300'
          : 'border border-white/15 hover:bg-white/5'
      }`}
    >
      {busy ? '...' : children}
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
