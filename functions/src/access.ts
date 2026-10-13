// Same guard as firestore.rules: signed in, the one allowed email, verified.
// Pure file: the root test suite imports it.

export type TokenLike = { email?: string; email_verified?: boolean } | undefined;

export function isAllowed(token: TokenLike, allowedEmail: string): boolean {
  const allowed = allowedEmail.trim().toLowerCase();
  if (!token || !allowed) return false;
  return token.email_verified === true && (token.email ?? '').toLowerCase() === allowed;
}
