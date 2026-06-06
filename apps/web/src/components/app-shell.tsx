'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Logo } from './brand';
import { SidebarNav } from './sidebar-nav';
import { ArrowLeftIcon, CloseIcon, HelpIcon, LoginIcon, MenuIcon } from './icons';

/**
 * Responsive application shell.
 *  - Desktop (lg+): persistent left sidebar rail + sticky top bar.
 *  - Mobile: compact top bar with a hamburger that opens a slide-in drawer
 *    (mirrors the reference menu).
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();

  // Close the drawer on route change and lock body scroll while open.
  useEffect(() => setDrawerOpen(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [drawerOpen]);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[18rem_1fr]">
      {/* ---- Desktop sidebar rail ---- */}
      <aside className="sticky top-0 hidden h-screen flex-col border-r border-white/10 bg-black/40 px-4 py-5 lg:flex">
        <div className="px-2 pb-6">
          <Logo />
        </div>
        <div className="flex-1 overflow-y-auto pr-1">
          <SidebarNav />
        </div>
        <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3 text-[11px] leading-relaxed text-white/45">
          Devnet · sandbox. No real funds or payments.
        </div>
      </aside>

      {/* ---- Main column ---- */}
      <div className="flex min-h-screen flex-col">
        <TopBar onMenu={() => setDrawerOpen(true)} />
        <main className="flex-1">{children}</main>
      </div>

      {/* ---- Mobile drawer ---- */}
      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  );
}

function TopBar({ onMenu }: { onMenu: () => void }) {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-white/10 bg-booster-dark/80 px-4 py-3 backdrop-blur lg:px-8">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenu}
          aria-label="Open menu"
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white lg:hidden"
        >
          <MenuIcon />
        </button>
        <div className="lg:hidden">
          <Logo compact />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Help"
          className="hidden h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/80 hover:text-white sm:flex"
        >
          <HelpIcon />
        </button>
        <AuthControls />
      </div>
    </header>
  );
}

function AuthControls() {
  const { ready, authenticated, login, logout, dbUser } = useAuth();

  if (!ready) {
    return <div className="h-10 w-24 animate-pulse rounded-xl bg-white/5" aria-hidden />;
  }

  if (authenticated) {
    const label = dbUser?.displayName || dbUser?.email || 'Account';
    return (
      <div className="flex items-center gap-2">
        <Link
          href="/account"
          className="flex h-10 max-w-[10rem] items-center gap-2 truncate rounded-xl border border-white/10 bg-white/5 px-3.5 text-sm font-medium text-white/90 hover:bg-white/10"
          title={label}
        >
          <span className="h-6 w-6 shrink-0 rounded-full bg-gradient-to-br from-booster to-emerald-400" />
          <span className="truncate">{label}</span>
        </Link>
        <button
          type="button"
          onClick={logout}
          className="flex h-10 items-center rounded-xl border border-white/10 bg-white/5 px-3.5 text-sm font-medium text-white/70 hover:text-white"
        >
          Logout
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={login}
        className="flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3.5 text-sm font-medium text-white/90 hover:bg-white/10"
      >
        <LoginIcon />
        <span>Login</span>
      </button>
      <button
        type="button"
        onClick={login}
        className="flex h-10 items-center rounded-xl bg-white px-4 text-sm font-semibold text-black hover:bg-white/90"
      >
        Sign Up
      </button>
    </>
  );
}

function MobileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <div
      className={['fixed inset-0 z-50 lg:hidden', open ? '' : 'pointer-events-none'].join(' ')}
      aria-hidden={!open}
    >
      <div
        onClick={onClose}
        className={[
          'absolute inset-0 bg-black/60 transition-opacity duration-300',
          open ? 'opacity-100' : 'opacity-0',
        ].join(' ')}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={[
          'absolute inset-y-0 left-0 flex w-[86%] max-w-sm flex-col bg-booster-dark px-4 py-5 shadow-2xl transition-transform duration-300',
          open ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        <div className="flex items-center justify-between px-2 pb-6">
          <Logo />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-white/70 hover:text-white"
          >
            <ArrowLeftIcon />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto pr-1">
          <SidebarNav onNavigate={onClose} />
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm text-white/70"
        >
          <CloseIcon /> Close
        </button>
      </div>
    </div>
  );
}
