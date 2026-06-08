'use client';

import type { ReactNode } from 'react';
import { PrivyProvider } from '@privy-io/react-auth';
import { toSolanaWalletConnectors } from '@privy-io/react-auth/solana';
import { PrivyAuthBridge, UnconfiguredAuthBridge } from '@/lib/auth-context';
import { LanguageProvider } from '@/i18n/language-context';

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? '';

/**
 * Top-level client providers. Wires real Privy auth with email/Google/Apple
 * login, embedded Solana wallets, and external Solana wallet connect (Phantom,
 * etc.). When no app id is configured, falls back to a no-op bridge so the rest
 * of the UI still renders.
 */
export function Providers({ children }: { children: ReactNode }) {
  if (!PRIVY_APP_ID) {
    return (
      <LanguageProvider>
        <UnconfiguredAuthBridge>{children}</UnconfiguredAuthBridge>
      </LanguageProvider>
    );
  }

  return (
    <LanguageProvider>
      <PrivyProvider
        appId={PRIVY_APP_ID}
        config={{
          loginMethods: ['email', 'google', 'apple', 'wallet'],
          appearance: {
            theme: 'dark',
            accentColor: '#6d28d9',
            walletChainType: 'solana-only',
          },
          embeddedWallets: {
            solana: { createOnLogin: 'users-without-wallets' },
          },
          externalWallets: {
            solana: { connectors: toSolanaWalletConnectors() },
          },
        }}
      >
        <PrivyAuthBridge>{children}</PrivyAuthBridge>
      </PrivyProvider>
    </LanguageProvider>
  );
}
