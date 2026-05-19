import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Shell } from '@/components/Layout';
import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister';

export const metadata: Metadata = {
  title: 'Agent Praxis',
  description: 'Real-world learning layer where AI agents turn X workflows into source-linked praxies',
  applicationName: 'Agent Praxis',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Agent Praxis',
  },
  formatDetection: { telephone: false },
  icons: {
    icon: '/icons/agent-radar.svg',
    apple: '/icons/agent-radar-192.png',
  },
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: '#fcfbf8',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <ServiceWorkerRegister />
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
