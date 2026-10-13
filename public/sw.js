// ============================================================
// legi - Service worker
//
// Based on fina/noda (public/sw.js) with one deliberate difference:
// HTML is stale-while-revalidate, not network-first.
//
// legi is a static site; all data lives in Firestore (with its own cache). So
// HTML one build old is still correct - just last build's UI. In return the
// app opens with a page at once, even on a weak or missing network. The new
// build downloads in the background and is used on the next open.
//
// /_next/static/*  cache-first forever (file names hash their content).
// HTML             stale-while-revalidate, cache key without query (?id=…).
// Firestore/Auth   NOT touched (other origin, or /__/).
//
// On install: precache every page + all JS/CSS those pages need, so the first
// offline tap over to the shelf still works.
// ============================================================

const CACHE_VERSION = 'legi-v1';
const PAGES = ['/', '/shelf/', '/book/', '/inbox/', '/slow/', '/search/', '/trash/', '/settings/', '/capture/', '/questions/', '/login/'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(precache());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function precache() {
  const cache = await caches.open(CACHE_VERSION);
  const assets = new Set(['/favicon.svg', '/branding/legi-icon.svg', '/manifest.webmanifest']);
  await Promise.all(
    PAGES.map(async (path) => {
      try {
        const res = await fetch(path, { cache: 'no-cache' });
        if (!res.ok) return;
        const html = await res.clone().text();
        await cache.put(path, res);
        for (const m of html.matchAll(/["'(](\/_next\/static\/[^"'()\s]+)/g)) assets.add(m[1]);
      } catch {
        // Offline during install: try again next time.
      }
    }),
  );
  await Promise.all(
    [...assets].map((url) =>
      cache.match(url).then((hit) => hit || fetch(url).then((r) => r.ok && cache.put(url, r)).catch(() => {})),
    ),
  );
}

function isStatic(url) {
  return url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/');
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/__/')) return;

  if (isStatic(url)) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  if (req.mode === 'navigate') {
    const key = url.pathname;
    event.respondWith(
      caches.open(CACHE_VERSION).then(async (cache) => {
        const hit = await cache.match(key);
        const fresh = fetch(req)
          .then((res) => {
            if (res.ok) cache.put(key, res.clone());
            return res;
          })
          .catch(() => null);
        if (hit) {
          event.waitUntil(fresh);
          return hit;
        }
        return (await fresh) || (await cache.match('/')) || Response.error();
      }),
    );
  }
});
