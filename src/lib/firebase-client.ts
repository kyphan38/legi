// ============================================================
// legi - Firebase client SDK (browser only)
//
// Unlike fina: LAZY init (created on first call), never throws on import.
// legi is a static site - every page is prerendered at build, and this module
// still loads then. A top-level throw would break the build when env is missing.
//
// NEXT_PUBLIC_USE_EMULATORS=1 (npm run dev:emu) connects to the Auth/Firestore
// emulators with the fake project 'demo-legi' - runs without a real project.
// ============================================================

import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
import {
  connectFirestoreEmulator,
  getFirestore,
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions, type Functions } from 'firebase/functions';

export const USE_EMULATORS = process.env.NEXT_PUBLIC_USE_EMULATORS === '1';

/**
 * On the real domain, authDomain = the app's own domain (vercel.json proxies
 * /__/auth/* to firebaseapp.com). With firebaseapp.com, Safari on iPhone and
 * iPad treats it as third-party and blocks storage, so Google sign-in cannot
 * report back (auth/popup-closed-by-user).
 *
 * localhost and *.vercel.app previews keep firebaseapp.com: those hosts have
 * no redirect URI in the Google OAuth client yet.
 */
function resolveAuthDomain(): string | undefined {
  const fallback = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
  if (typeof window === 'undefined') return fallback;
  const { protocol, host, hostname } = window.location;
  if (protocol !== 'https:' || hostname.endsWith('.vercel.app')) return fallback;
  return host;
}

// Next.js only inlines NEXT_PUBLIC_* vars written out in full, not destructured.
const realConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: resolveAuthDomain(),
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const emulatorConfig = {
  apiKey: 'demo-key',
  authDomain: 'demo-legi.firebaseapp.com',
  projectId: 'demo-legi',
  appId: 'demo-app',
};

/** Which env vars are missing (empty = all set). The login screen uses it for a clear error. */
export function missingConfig(): string[] {
  if (USE_EMULATORS) return [];
  return Object.entries(realConfig)
    .filter(([, v]) => !v)
    .map(([k]) => k);
}

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let fns: Functions | null = null;

function getFirebaseApp(): FirebaseApp {
  if (app) return app;
  const missing = missingConfig();
  if (missing.length > 0) {
    throw new Error(`[firebase] Missing env: ${missing.join(', ')}. See .env.example.`);
  }
  app = getApps().length ? getApp() : initializeApp(USE_EMULATORS ? emulatorConfig : realConfig);
  return app;
}

export function getAuthClient(): Auth {
  if (auth) return auth;
  auth = getAuth(getFirebaseApp());
  if (USE_EMULATORS) connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  return auth;
}

export function getDb(): Firestore {
  if (db) return db;
  const firebase = getFirebaseApp();
  try {
    // Offline-first: write with no signal, sync when back online.
    db = initializeFirestore(firebase, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch (err) {
    // Safari private mode blocks IndexedDB → in-memory cache.
    console.warn('[firebase] persistent cache unavailable, using memory cache', err);
    try {
      db = initializeFirestore(firebase, { localCache: memoryLocalCache() });
    } catch {
      db = getFirestore(firebase);
    }
  }
  if (USE_EMULATORS) connectFirestoreEmulator(db, '127.0.0.1', 8080);
  return db;
}

/** Cloud Functions (AI only). Same region as functions/src/index.ts. */
export function getFunctionsClient(): Functions {
  if (fns) return fns;
  fns = getFunctions(getFirebaseApp(), 'asia-southeast1');
  if (USE_EMULATORS) connectFunctionsEmulator(fns, '127.0.0.1', 5001);
  return fns;
}
