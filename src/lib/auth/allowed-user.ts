// ============================================================
// legi - Client-side allowlist
//
// Only an early, readable block ("account not authorized"). The real guard is
// firestore.rules - anyone can edit the client.
// ============================================================

import type { User } from 'firebase/auth';

import { USE_EMULATORS } from '@/lib/firebase-client';

/** Email used with the emulator when there is no .env.local - matches scripts/rules.mjs --emu. */
export const DEV_EMAIL = 'dev@legi.test';

/** Allowed email, normalized ('' = not configured). */
export const allowedEmail = (
  process.env.NEXT_PUBLIC_ALLOWED_USER_EMAIL || (USE_EMULATORS ? DEV_EMAIL : '')
)
  .trim()
  .toLowerCase();

export function hasAllowlist(): boolean {
  return allowedEmail !== '';
}

export function isAllowedUser(user: User | null): boolean {
  if (!user?.email || !allowedEmail) return false;
  return user.email.trim().toLowerCase() === allowedEmail;
}
