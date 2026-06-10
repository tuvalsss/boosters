// Unauthenticated API helper for public reads (browse, listing detail). For
// authenticated calls use `useAuth().apiFetch` which attaches the Privy token.

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export async function publicFetch<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}/api${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  return parseApiResponse<T>(res);
}

export async function parseApiResponse<T = unknown>(res: Response): Promise<T> {
  const contentType = res.headers.get('content-type') ?? '';
  const text = await res.text();

  if (!res.ok) {
    const body = parseJson(text, contentType);
    throw new Error(apiMessage(body) ?? `API request failed (${res.status})`);
  }

  const body = parseJson(text, contentType);
  if (body === null) {
    throw new Error(
      contentType.includes('text/html')
        ? 'The API returned HTML instead of JSON. Make sure the API server is running and NEXT_PUBLIC_API_URL points to it.'
        : 'The API returned an empty or invalid JSON response.',
    );
  }
  return body as T;
}

/** Format a USDC decimal string for display. */
export const usd = (v: string | number): string =>
  `$${Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

function parseJson(text: string, contentType: string): unknown | null {
  if (!text.trim()) return null;
  if (contentType && !contentType.includes('json')) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function apiMessage(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const message = (body as { message?: unknown }).message;
  if (Array.isArray(message)) return message.join(', ');
  return typeof message === 'string' ? message : null;
}
