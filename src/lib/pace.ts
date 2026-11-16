// legi - Reading pace from the page log, and the day a book should be done.
// Pure: no React, no Firebase.

import { addDays, diffDays } from '@/lib/day';

/** One entry per day: the page reached that day. */
export type PageMark = { d: string; p: number };

/** Kept on the book doc; older marks fall off. Must match firestore.rules.template. */
export const PAGE_LOG_MAX = 30;
/** Pace looks at this many days back. */
export const PACE_WINDOW_DAYS = 14;

/** The log with today's page set (one mark per day, newest last, capped). */
export function logPage(log: PageMark[] | undefined, day: string, page: number): PageMark[] {
  const rest = (log ?? []).filter((m) => m.d !== day);
  return [...rest, { d: day, p: page }].sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0)).slice(-PAGE_LOG_MAX);
}

/**
 * Pages a day over the last PACE_WINDOW_DAYS, or null when it cannot be told:
 * fewer than two marks, under two days apart, or no pages gained.
 * The baseline is the last mark before the window, so a slow week still counts.
 */
export function pagesPerDay(log: PageMark[] | undefined, today: string): number | null {
  const marks = (log ?? []).filter((m) => m.d <= today);
  if (marks.length < 2) return null;
  const from = addDays(today, -PACE_WINDOW_DAYS);
  const before = marks.filter((m) => m.d < from);
  const base = before.length ? before[before.length - 1] : marks[0];
  const last = marks[marks.length - 1];
  // Days up to today, so not reading lately slows the pace down.
  const days = diffDays(base.d, today);
  const gained = last.p - base.p;
  if (days < 2 || gained <= 0) return null;
  return gained / days;
}

/** Day the book should be done at the current pace, or null when unknown. */
export function finishDay(
  log: PageMark[] | undefined,
  currentPage: number | null,
  totalPages: number | null,
  today: string,
): string | null {
  if (!currentPage || !totalPages || currentPage >= totalPages) return null;
  const rate = pagesPerDay(log, today);
  if (rate === null) return null;
  const left = Math.ceil((totalPages - currentPage) / rate);
  // Over a year out says nothing useful.
  if (left > 365) return null;
  return addDays(today, left);
}
