'use client';

import { useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';

const STORAGE_KEY = 'boosters.referralCode';

export function ReferralCapture() {
  const { ready, authenticated, apiFetch } = useAuth();

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('ref');
    if (code?.trim()) {
      window.localStorage.setItem(STORAGE_KEY, code.trim());
    }
  }, []);

  useEffect(() => {
    if (!ready || !authenticated) return;
    const code = window.localStorage.getItem(STORAGE_KEY);
    if (!code) return;

    let active = true;
    void apiFetch('/me/referrals', {
      method: 'POST',
      body: JSON.stringify({ code }),
    })
      .then(() => {
        if (active) window.localStorage.removeItem(STORAGE_KEY);
      })
      .catch(() => {
        // Keep the code locally so a temporary API outage can be retried later.
      });

    return () => {
      active = false;
    };
  }, [ready, authenticated, apiFetch]);

  return null;
}
