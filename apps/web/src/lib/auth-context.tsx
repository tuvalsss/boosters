'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { usePrivy } from '@privy-io/react-auth';
import type { PublicUser } from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export interface AuthState {
  /** Privy SDK ready. */
  ready: boolean;
  /** Whether Privy is configured at all (NEXT_PUBLIC_PRIVY_APP_ID present). */
  configured: boolean;
  authenticated: boolean;
  login: () => void;
  logout: () => void;
  /** The durable DB user (role, kyc, hold) — null until loaded. */
  dbUser: PublicUser | null;
  refreshMe: () => Promise<void>;
  /** Authenticated fetch against the API; attaches the Privy access token. */
  apiFetch: <T = unknown>(path: string, init?: RequestInit) => Promise<T>;
}

const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <Providers>');
  return ctx;
}

/** Bridge that reads the live Privy session (only mounted when configured). */
export function PrivyAuthBridge({ children }: { children: ReactNode }) {
  const { ready, authenticated, login, logout, getAccessToken } = usePrivy();
  const [dbUser, setDbUser] = useState<PublicUser | null>(null);

  const apiFetch = useCallback(
    async <T,>(path: string, init: RequestInit = {}): Promise<T> => {
      const token = await getAccessToken();
      const res = await fetch(`${API_URL}/api${path}`, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(init.headers ?? {}),
        },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { message?: string }).message ?? `Request failed (${res.status})`);
      }
      return (res.status === 204 ? undefined : await res.json()) as T;
    },
    [getAccessToken],
  );

  const refreshMe = useCallback(async () => {
    if (!authenticated) {
      setDbUser(null);
      return;
    }
    try {
      setDbUser(await apiFetch<PublicUser>('/me'));
    } catch {
      setDbUser(null);
    }
  }, [authenticated, apiFetch]);

  useEffect(() => {
    void refreshMe();
  }, [refreshMe]);

  const value = useMemo<AuthState>(
    () => ({
      ready,
      configured: true,
      authenticated,
      login,
      logout,
      dbUser,
      refreshMe,
      apiFetch,
    }),
    [ready, authenticated, login, logout, dbUser, refreshMe, apiFetch],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Fallback used when Privy is not configured — keeps the UI fully functional. */
export function UnconfiguredAuthBridge({ children }: { children: ReactNode }) {
  const notConfigured = () =>
    alert('Auth is not configured yet. Set NEXT_PUBLIC_PRIVY_APP_ID (and server keys) in .env.');

  const value = useMemo<AuthState>(
    () => ({
      ready: true,
      configured: false,
      authenticated: false,
      login: notConfigured,
      logout: () => {},
      dbUser: null,
      refreshMe: async () => {},
      apiFetch: async () => {
        throw new Error('Auth not configured');
      },
    }),
    [],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
