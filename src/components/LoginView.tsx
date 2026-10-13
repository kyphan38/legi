'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { useAuth } from '@/contexts/AuthContext';
import { hasAllowlist } from '@/lib/auth/allowed-user';
import { missingConfig } from '@/lib/firebase-client';

export default function LoginView() {
  const router = useRouter();
  const { user, loading, signingIn, error, signIn } = useAuth();
  const missing = missingConfig();

  useEffect(() => {
    if (!loading && user) router.replace('/');
  }, [loading, user, router]);

  return (
    <main className="paper flex min-h-dvh flex-col items-center justify-center gap-8 pb-[12dvh] text-center">
      <div className="flex flex-col items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element -- static SVG, no image optimization needed */}
        <img src="/branding/legi-icon.svg" alt="" width={40} height={40} />
        <div>
          <h1 className="text-xl font-medium tracking-tight">legi</h1>
          <p className="mt-1 text-sm text-faint">Quotes from the books you read.</p>
        </div>
      </div>

      {missing.length > 0 || !hasAllowlist() ? (
        <p className="max-w-xs text-sm text-muted">
          Firebase is not configured yet. Fill <code className="font-mono text-xs">.env.local</code> using{' '}
          <code className="font-mono text-xs">.env.example</code>.
        </p>
      ) : (
        <button
          type="button"
          onClick={signIn}
          disabled={loading || signingIn}
          className="w-full max-w-xs rounded-full border border-line px-4 py-3 text-sm text-ink transition-colors hover:bg-wash disabled:opacity-40"
        >
          {signingIn ? 'Signing in…' : 'Continue with Google'}
        </button>
      )}

      {error && (
        <p role="alert" className="max-w-xs text-sm text-muted">
          {error}
        </p>
      )}
    </main>
  );
}
