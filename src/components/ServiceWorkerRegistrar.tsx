'use client';

import { useEffect } from 'react';

import { registerServiceWorker } from '@/lib/sw';

/** Registers the service worker for the whole app. Lives in the root layout, renders nothing. */
export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    void registerServiceWorker();
  }, []);
  return null;
}
