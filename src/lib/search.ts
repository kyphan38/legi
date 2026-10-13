// ============================================================
// legi - Search (pure, offline)
//
// Marks are ignored ("thoi quen" finds "thói quen", "duong" finds "đường").
// A quote matches when EVERY word of the query is in its text + note.
// Results are grouped by book, books with more hits first, 50 quotes max.
// ============================================================

import { fold, foldWithMap } from '@/lib/vi';
import type { BookRow, QuoteRow } from '@/types/legi';

export const MAX_RESULTS = 50;

export type QuoteHit = { quote: QuoteRow; marks: [number, number][] };
export type BookGroup = { bookId: string | null; hits: QuoteHit[] };
export type SearchResult = { groups: BookGroup[]; books: BookRow[]; sections: { book: BookRow; id: string; title: string }[] };

export function words(query: string): string[] {
  return fold(query).split(' ').filter(Boolean);
}

/** Char ranges in the ORIGINAL text that match any of the words. */
export function markRanges(text: string, ws: string[]): [number, number][] {
  const { folded, map, parts } = foldWithMap(text);
  // Grapheme index → char offset in the original string.
  const offsets: number[] = [];
  let at = 0;
  for (const p of parts) {
    offsets.push(at);
    at += p.length;
  }
  offsets.push(at);
  const ranges: [number, number][] = [];
  for (const w of ws) {
    let from = 0;
    while (w && (from = folded.indexOf(w, from)) !== -1) {
      const g0 = map[from];
      const g1 = map[from + w.length - 1];
      ranges.push([offsets[g0], offsets[g1 + 1]]);
      from += w.length;
    }
  }
  ranges.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const r of ranges) {
    const last = merged.at(-1);
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([...r]);
  }
  return merged;
}

export function searchAll(query: string, books: BookRow[], quotes: QuoteRow[]): SearchResult {
  const ws = words(query);
  if (ws.length === 0) return { groups: [], books: [], sections: [] };
  const has = (s: string) => {
    const f = fold(s);
    return ws.every((w) => f.includes(w));
  };

  const byBook = new Map<string | null, QuoteHit[]>();
  let total = 0;
  for (const q of quotes) {
    if (total >= MAX_RESULTS) break;
    if (!has(`${q.text} ${q.note}`)) continue;
    total++;
    const key = q.bookId;
    const hit = { quote: q, marks: markRanges(q.text.replace(/\*\*/g, ''), ws) };
    const list = byBook.get(key);
    if (list) list.push(hit);
    else byBook.set(key, [hit]);
  }
  const groups = [...byBook.entries()].map(([bookId, hits]) => ({ bookId, hits })).sort((a, b) => b.hits.length - a.hits.length);

  const live = books.filter((b) => b.deletedAt === null);
  return {
    groups,
    books: live.filter((b) => has(`${b.title} ${b.author}`)),
    sections: live.flatMap((b) => b.sections.filter((s) => has(s.title)).map((s) => ({ book: b, id: s.id, title: s.title }))),
  };
}
