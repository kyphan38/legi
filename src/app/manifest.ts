import type { MetadataRoute } from 'next';

import { BG_LIGHT } from '@/lib/prefs';

export const dynamic = 'force-static';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'legi',
    short_name: 'legi',
    description: 'Quotes from the books you read',
    // Opens the last book with the cursor ready.
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: BG_LIGHT,
    theme_color: BG_LIGHT,
    shortcuts: [{ name: 'New quote', url: '/?new=1' }],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
