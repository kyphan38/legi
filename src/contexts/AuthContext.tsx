'use client';

// ============================================================
// legi - Sign-in (client only)
//
// Based on fina/src/contexts/AuthContext.tsx but WITHOUT a session cookie or
// /api/auth/session: legi has no server. Firebase Auth keeps the session in
// IndexedDB, so an offline app start still knows who is signed in.
//
// uidHintStore remembers the last uid so the writing page shows AT ONCE,
// without waiting for Firebase Auth to read IndexedDB (no spinner before writing).
// ============================================================

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  GoogleAuthProvider,
  getRedirectResult,
  onAuthStateChanged,
  signInWithCredential,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import { clearIndexedDbPersistence, terminate } from 'firebase/firestore';

import { allowedEmail, isAllowedUser } from '@/lib/auth/allowed-user';
import { USE_EMULATORS, getAuthClient, getDb, missingConfig } from '@/lib/firebase-client';
import { clearSnaps } from '@/lib/snaps';
import { clearLegiStorage, stringStore } from '@/lib/store';

const NOT_AUTHORIZED = 'This account is not allowed here.';
const UNAUTHORIZED_DOMAIN =
  'This domain is not allowed to sign in. Add it in Firebase Console → Authentication → Settings → Authorized domains.';
const GENERIC = 'Sign-in failed. Please try again.';

/** uid from the last sign-in, '' if none. */
export const uidHintStore = stringStore<string>('legi.uid', '', (raw) => raw);

type AuthState = {
  user: User | null;
  /** true while sign-in state is unknown. */
  loading: boolean;
  signingIn: boolean;
  error: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

/** iPhone, iPad (iPadOS reports "Macintosh") or a Home Screen app. */
function prefersRedirect(): boolean {
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return ios || standalone;
}

function newProvider() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return provider;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = missingConfig().length === 0;
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(configured);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!configured) return;
    const auth = getAuthClient();

    // Result of signInWithRedirect (fallback when iOS blocks the popup).
    getRedirectResult(auth).catch((err) => {
      // onAuthStateChanged still runs; an error here does not block the app.
      console.warn('[auth] redirect result failed', err);
    });

    return onAuthStateChanged(auth, async (next) => {
      if (next && !isAllowedUser(next)) {
        setError(NOT_AUTHORIZED);
        uidHintStore.set('');
        setUser(null);
        setLoading(false);
        await firebaseSignOut(auth);
        return;
      }
      uidHintStore.set(next?.uid ?? '');
      setUser(next);
      setLoading(false);
    });
  }, [configured]);

  const signIn = useCallback(async () => {
    setError(null);
    setSigningIn(true);
    try {
      // Emulator: sign in directly with a fake Google credential (the emulator
      // accepts an unsigned JSON token). Popup/redirect need a cross-origin
      // iframe that test browsers often block.
      if (USE_EMULATORS) {
        const token = JSON.stringify({ sub: 'dev-legi', email: allowedEmail, email_verified: true });
        await signInWithCredential(getAuthClient(), GoogleAuthProvider.credential(token));
        return;
      }
      // Redirect only works when the sign-in page is on the same domain
      // (vercel.json); otherwise Safari loses the result.
      const auth = getAuthClient();
      if (auth.config.authDomain === window.location.host && prefersRedirect()) {
        await signInWithRedirect(auth, newProvider());
        return; // the page will navigate away
      }
      await signInWithPopup(auth, newProvider());
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code ?? '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        // The user closed it - stay quiet.
      } else if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
        try {
          await signInWithRedirect(getAuthClient(), newProvider());
          return; // the page will navigate away
        } catch {
          setError(GENERIC);
        }
      } else if (code === 'auth/unauthorized-domain') {
        setError(UNAUTHORIZED_DOMAIN);
      } else if (code === 'auth/network-request-failed') {
        setError('No network connection. Check your connection and try again.');
      } else {
        setError(GENERIC);
      }
    } finally {
      setSigningIn(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await firebaseSignOut(getAuthClient());
    } finally {
      // Privacy: also clear drafts and the Firestore cache on this device.
      clearLegiStorage();
      await clearSnaps();
      try {
        const db = getDb();
        await terminate(db);
        await clearIndexedDbPersistence(db);
      } catch {
        // Another open tab blocks clearing the cache - still sign out normally.
      }
      window.location.replace('/login/');
    }
  }, []);

  const value = useMemo<AuthState>(
    () => ({ user, loading, signingIn, error, signIn, signOut }),
    [user, loading, signingIn, error, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>.');
  return ctx;
}
