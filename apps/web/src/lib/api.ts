// Unauthenticated API helper for public reads (browse, listing detail). For
// authenticated calls use `useAuth().apiFetch` which attaches the Privy token.

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export async function publicFetch<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}/api${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { message?: string }).message ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

/** Format a USDC decimal string for display. */
export const usd = (v: string | number): string =>
  `$${Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
