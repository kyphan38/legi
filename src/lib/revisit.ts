// legi - "Read again": a book finished long ago that left many quotes.
// Pure: no React, no Firebase.

import { hashString } from '@/lib/daily';
import { dayOf, diffDays } from '@/lib/day';
import type { BookRow } from '@/types/legi';

/** Finished at least this long ago. */
export const REVISIT_AFTER_DAYS = 182;
/** Only books that left this many quotes or more. */
export const REVISIT_MIN_QUOTES = 10;
/** The day's pick comes from the books with the most quotes. */
const POOL = 5;

/** One book for today (stable all day), or null when none fits. */
export function readAgain(
  books: BookRow[],
  quoteCount: (bookId: string) => number,
  today: string,
): { book: BookRow; count: number } | null {
  const pool = books
    .filter((b) => b.deletedAt === null && b.status === 'finished' && b.finishedAt !== null)
    .filter((b) => diffDays(dayOf(b.finishedAt!), today) >= REVISIT_AFTER_DAYS)
    .map((book) => ({ book, count: quoteCount(book.id) }))
    .filter((x) => x.count >= REVISIT_MIN_QUOTES)
    .sort((a, b) => b.count - a.count || a.book.id.localeCompare(b.book.id))
    .slice(0, POOL);
  if (pool.length === 0) return null;
  return pool[hashString(today) % pool.length];
}
