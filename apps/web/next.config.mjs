import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as dotenvConfig } from 'dotenv';

// Single source of truth: load the monorepo-root `.env` so the web app shares
// the same file as api/worker (no per-app env files).
const here = dirname(fileURLToPath(import.meta.url));
let dir = here;
for (let i = 0; i < 8; i++) {
  if (existsSync(join(dir, 'pnpm-workspace.yaml'))) {
    dotenvConfig({ path: join(dir, '.env') });
    break;
  }
  dir = dirname(dir);
}

// Privy lazily references optional Solana submodules (memo program, Farcaster
// mini-app) that we don't use and that conflict with our @solana/kit version.
// Treat them as absent so webpack doesn't try to resolve them.
const OPTIONAL_ABSENT = ['@farcaster/mini-app-solana', '@solana-program/memo', '@stripe/crypto'];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@boosters/config'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: '**' },
    ],
  },
  webpack: (config) => {
    config.resolve.alias = { ...config.resolve.alias };
    for (const mod of OPTIONAL_ABSENT) config.resolve.alias[mod] = false;
    return config;
  },
  // Re-expose public vars read from the root .env (Next only auto-loads its own dir).
  env: {
    NEXT_PUBLIC_PRIVY_APP_ID: process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? '',
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000',
    NEXT_PUBLIC_SOLANA_CLUSTER: process.env.NEXT_PUBLIC_SOLANA_CLUSTER ?? 'devnet',
  },
  async headers() {
    return [
      {
        // Service worker must be served from the root scope.
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ];
  },
};

export default nextConfig;
