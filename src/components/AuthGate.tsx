'use client';

import { createContext, useContext, useEffect, useSyncExternalStore, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';

import { uidHintStore, useAuth } from '@/contexts/AuthContext';

const UidContext = createContext<string | null>(null);

/** uid of the writer. Only use inside <AuthGate>. */
export function useUid(): string {
  const uid = useContext(UidContext);
  if (!uid) throw new Error('useUid must be used inside <AuthGate>.');
  return uid;
}

/**
 * Sign-in gate for every page in (main).
 *
 * With last session's uid (uidHintStore), the page shows at once, without
 * waiting for Firebase Auth. Only if the user turns out to be signed out does
 * it go to /login. Never a spinner: while waiting it is just a blank page.
 */
export default function AuthGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const hint = useSyncExternalStore(uidHintStore.subscribe, uidHintStore.get, uidHintStore.getServer);

  const uid = user?.uid ?? (loading && hint ? hint : null);

  useEffect(() => {
    if (!loading && !user) router.replace('/login/');
  }, [loading, user, router]);

  if (!uid) return <div className="min-h-dvh" />;
  return <UidContext.Provider value={uid}>{children}</UidContext.Provider>;
}
