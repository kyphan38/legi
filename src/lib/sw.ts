// ============================================================
// legi - Service worker registration (copied from fina/src/lib/sw.ts)
//
// Imports nothing, on purpose: the app-shell cache decides how fast the app
// opens and must not depend on any other SDK.
// Only registers in a build: in dev, cache-first would keep old code and confuse.
// ============================================================

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;
  if (process.env.NODE_ENV !== 'production') return null;
  try {
    return await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  } catch {
    // Safari private mode and some other contexts refuse. The app still works.
    return null;
  }
}
