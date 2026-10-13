// ============================================================
// legi - Merge and split (pure). repo.ts writes the result.
// ============================================================

import type { Quote } from '@/types/legi';

type Q = Pick<Quote, 'text' | 'note' | 'page' | 'favorite'>;

/** Quotes in display order → one quote. Text joins with a space (a sentence split by mistake). */
export function mergeFields(quotes: Q[]): Q {
  const pages = quotes.map((q) => q.page).filter((p): p is number => p !== null);
  return {
    text: quotes.map((q) => q.text.trim()).join(' '),
    note: quotes
      .map((q) => q.note.trim())
      .filter(Boolean)
      .join('\n\n'),
    page: pages.length ? Math.min(...pages) : null,
    favorite: quotes.some((q) => q.favorite),
  };
}

/** Splits at a caret position. Null if either side would be empty. */
export function splitText(text: string, at: number): [string, string] | null {
  const a = text.slice(0, at).trim();
  const b = text.slice(at).trim();
  if (!a || !b) return null;
  return [a, b];
}
