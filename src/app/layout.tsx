import type { Metadata, Viewport } from 'next';

import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import ServiceWorkerRegistrar from '@/components/ServiceWorkerRegistrar';
import { BG_DARK, BG_LIGHT, THEME_SCRIPT } from '@/lib/prefs';

// The tab title is always "legi" - never a book or a quote. No page sets its own title.
export const metadata: Metadata = {
  title: 'legi',
  description: 'Quotes from the books you read',
  icons: {
    icon: '/favicon.svg',
    apple: '/icons/apple-touch-icon.png',
  },
  appleWebApp: { capable: true, title: 'legi', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  // No zoom lock: this is a reading app, zoom belongs to the eyes.
  // Inputs are >= 16px, so iOS does not zoom on focus.
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: BG_LIGHT },
    { media: '(prefers-color-scheme: dark)', color: BG_DARK },
  ],
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    // data-theme/data-size are set by THEME_SCRIPT before React hydrates.
    <html lang="en" data-size="m" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <AuthProvider>{children}</AuthProvider>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
