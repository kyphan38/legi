// legi - One year of reading, for the Year page. Pure: no React, no Firebase.

import { dayOf } from '@/lib/day';
import type { BookRow, QuoteRow } from '@/types/legi';

export type YearStats = {
  year: number;
  /** Books finished that year, newest first, with the quotes saved from each (any year). */
  finished: { book: BookRow; quotes: number }[];
  /** Pages of the finished books whose page count is known. */
  pages: number;
  /** Saved that year, by kind. */
  quotes: number;
  thoughts: number;
  questions: number;
  /** The book that got the most quotes that year. */
  top: { book: BookRow; quotes: number } | null;
};

const yearOf = (ts: number) => Number(dayOf(ts).slice(0, 4));

/** Years with any finished book or saved quote, newest first; always has the current one. */
export function yearsWithData(books: BookRow[], quotes: QuoteRow[], now: number): number[] {
  const years = new Set<number>([yearOf(now)]);
  for (const b of books) if (b.deletedAt === null && b.finishedAt !== null) years.add(yearOf(b.finishedAt));
  for (const q of quotes) if (q.deletedAt === null) years.add(yearOf(q.createdAt));
  return [...years].sort((a, b) => b - a);
}

export function yearStats(books: BookRow[], quotes: QuoteRow[], year: number): YearStats {
  const live = quotes.filter((q) => q.deletedAt === null);
  const perBook = new Map<string, number>();
  for (const q of live) if (q.bookId) perBook.set(q.bookId, (perBook.get(q.bookId) ?? 0) + 1);

  const finished = books
    .filter((b) => b.deletedAt === null && b.status === 'finished' && b.finishedAt !== null && yearOf(b.finishedAt) === year)
    .sort((a, b) => b.finishedAt! - a.finishedAt!)
    .map((book) => ({ book, quotes: perBook.get(book.id) ?? 0 }));

  const inYear = live.filter((q) => yearOf(q.createdAt) === year);
  const thisYear = new Map<string, number>();
  for (const q of inYear) if (q.bookId) thisYear.set(q.bookId, (thisYear.get(q.bookId) ?? 0) + 1);
  const byId = new Map(books.filter((b) => b.deletedAt === null).map((b) => [b.id, b]));
  let top: YearStats['top'] = null;
  for (const [id, n] of thisYear) {
    const book = byId.get(id);
    if (book && (!top || n > top.quotes)) top = { book, quotes: n };
  }

  return {
    year,
    finished,
    pages: finished.reduce((sum, f) => sum + (f.book.totalPages ?? 0), 0),
    quotes: inYear.filter((q) => q.kind === 'quote').length,
    thoughts: inYear.filter((q) => q.kind === 'thought').length,
    questions: inYear.filter((q) => q.kind === 'question').length,
    top,
  };
}
