// ============================================================
// legi - Days (copied from hodi/src/lib/day.ts, trimmed)
//
// Pure file: no React, no Firestore, no DOM. Every "today" goes through
// dayOf() - never new Date().toISOString().slice(0, 10) (that is the UTC
// date, 7 hours off Vietnam time).
//
// A day starts at 04:00, not midnight: reading at 01:00 still belongs to the
// day before (one Daily quote per evening, not two).
// ============================================================

export const DAY_START_HOUR = 4;

const MS_HOUR = 3_600_000;

const pad = (n: number) => String(n).padStart(2, '0');

function toId(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** epoch ms → 'YYYY-MM-DD' in local time, day starting at 04:00. */
export function dayOf(ts: number): string {
  return toId(new Date(ts - DAY_START_HOUR * MS_HOUR));
}

/** 'YYYY-MM-DD' → Date at 12:00 noon (mid-day, safe from any offset). */
export function parseDay(id: string): Date {
  const [y, m, d] = id.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

export function isDayId(s: string | null | undefined): s is string {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return toId(parseDay(s)) === s;
}

export function addDays(id: string, n: number): string {
  const d = parseDay(id);
  d.setDate(d.getDate() + n);
  return toId(d);
}

/** Days from a to b (b - a). */
export function diffDays(a: string, b: string): number {
  return Math.round((parseDay(b).getTime() - parseDay(a).getTime()) / (24 * MS_HOUR));
}

/** 'MM-DD' - for "On this day". */
export function monthDay(id: string): string {
  return id.slice(5, 10);
}
