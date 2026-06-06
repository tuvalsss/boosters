'use client';

import { useEffect } from 'react';

/** Registers the PWA service worker on the client (installable app shell). */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV !== 'production') return; // avoid SW caching in dev
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* registration failures are non-fatal for the shell */
    });
  }, []);
  return null;
}
