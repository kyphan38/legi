// ============================================================
// legi - Search by meaning: the pure parts (no Firebase, no network).
// ============================================================

import { createHash } from 'node:crypto';

/** Must match the vector index in firestore.indexes.json. */
export const EMBED_DIM = 768;
export const SEARCH_LIMIT = 20;
/** Below this the quote is rarely about the query. */
export const SEARCH_MIN_SCORE = 0.45;
/** Long quotes are cut: the start carries most of the meaning and keeps calls small. */
const MAX_CHARS = 2_000;

export type QuoteForIndex = { kind?: unknown; text?: unknown; note?: unknown; deletedAt?: unknown };

/** The text that gets a vector, or null when the quote should have none (deleted or empty). */
export function embedText(q: QuoteForIndex): string | null {
  if (q.deletedAt !== null && q.deletedAt !== undefined) return null;
  const text = typeof q.text === 'string' ? q.text.replace(/\*\*/g, '').trim() : '';
  if (!text) return null;
  const note = typeof q.note === 'string' ? q.note.trim() : '';
  return (note ? `${text}\n${note}` : text).slice(0, MAX_CHARS);
}

/** Skips a new vector when the text did not change. */
export function textHash(text: string): string {
  return createHash('sha256').update(text).digest('hex').slice(0, 16);
}

export function checkQuery(data: unknown): string {
  const q = (data ?? {}) as { query?: unknown };
  const query = typeof q.query === 'string' ? q.query.trim().slice(0, 500) : '';
  if (!query) throw new Error('Empty query');
  return query;
}

/** Cosine distance (0 = same meaning) to a 0-1 score. */
export function scoreOf(distance: number): number {
  return Math.max(0, Math.min(1, 1 - distance));
}
