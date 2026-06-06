import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ServiceWorkerRegistrar } from './sw-registrar';
import { AppShell } from '@/components/app-shell';

export const metadata: Metadata = {
  title: 'Boosters',
  description: 'Phygital trading-card platform (devnet)',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Boosters',
  },
};

export const viewport: Viewport = {
  themeColor: '#4c1d95',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
