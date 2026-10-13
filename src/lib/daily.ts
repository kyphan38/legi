// ============================================================
// legi - Daily quote (pure)
//
// Quotes and thoughts take part (not questions).
// Same data + same day → same quote on every device (seeded RNG). No repeat
// until every quote was shown: only the least-shown group is picked from.
// Favorites weigh x3; favorites of a book finished ~1 week, ~1 month or
// ~3 months ago weigh x4 more (Revisit, the forgetting curve).
// ============================================================

import { diffDays, dayOf, monthDay } from '@/lib/day';
import type { BookRow, QuoteRow } from '@/types/legi';

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const REVISIT_WINDOWS: [number, number][] = [
  [5, 9],
  [27, 33],
  [85, 95],
];

/** x4 for a favorite of a book finished in one of the revisit windows. */
export function revisitBoost(book: BookRow | undefined, quote: QuoteRow, day: string): number {
  if (!quote.favorite || !book || book.status !== 'finished' || book.finishedAt === null) return 1;
  const since = diffDays(dayOf(book.finishedAt), day);
  return REVISIT_WINDOWS.some(([a, b]) => since >= a && since <= b) ? 4 : 1;
}

export function candidates(quotes: QuoteRow[], books: Map<string, BookRow>): QuoteRow[] {
  return quotes.filter((q) => {
    // Your own thoughts are worth meeting again too; open questions are not.
    if (q.kind === 'question' || q.deletedAt !== null) return false;
    if (q.bookId === null) return true;
    const b = books.get(q.bookId);
    return Boolean(b && b.deletedAt === null);
  });
}

export function pickDaily(quotes: QuoteRow[], books: Map<string, BookRow>, day: string): QuoteRow | null {
  const pool = candidates(quotes, books);
  if (pool.length === 0) return null;
  const least = Math.min(...pool.map((q) => q.shownCount));
  // Stable order first: the result must not depend on how the snapshot listed docs.
  const group = pool.filter((q) => q.shownCount === least).sort((a, b) => (a.id < b.id ? -1 : 1));
  const weights = group.map((q) => (q.favorite ? 3 : 1) * revisitBoost(q.bookId ? books.get(q.bookId) : undefined, q, day));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = mulberry32(hashString(day))() * total;
  for (let i = 0; i < group.length; i++) {
    r -= weights[i];
    if (r < 0) return group[i];
  }
  return group.at(-1) ?? null;
}

/** A quote written on this month-day in an earlier year (the most recent such year). */
export function onThisDay(quotes: QuoteRow[], day: string): QuoteRow | null {
  const md = monthDay(day);
  const year = day.slice(0, 4);
  const hits = quotes
    .filter((q) => q.deletedAt === null)
    .filter((q) => {
      const d = dayOf(q.createdAt);
      return monthDay(d) === md && d.slice(0, 4) < year;
    })
    .sort((a, b) => b.createdAt - a.createdAt);
  return hits[0] ?? null;
}
