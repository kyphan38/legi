// "Câu hay p52" → page 52. Only at the very end, so "help52" or a number
// inside the quote is never taken. "tr" is Vietnamese "trang" (page).

import type { Block } from '@/lib/paste';

const TOKEN = /\s+(?:p|tr)\.?\s?(\d{1,5})\s*$/i;

export function takePageToken(s: string): { text: string; page: number | null } {
  const m = s.match(TOKEN);
  if (!m) return { text: s, page: null };
  const page = Number(m[1]);
  if (page < 1 || page > 20000) return { text: s, page: null };
  return { text: s.slice(0, m.index).trimEnd(), page };
}

/**
 * A paste of many quotes: each quote may end with its own token ("... p52").
 * A quote without one stays on the page of the quote before it, the first
 * one on `fallback`. `pages` lines up with `blocks`; headings get null.
 */
export function pagesPerBlock(blocks: Block[], fallback: number | null): { blocks: Block[]; pages: (number | null)[] } {
  let last = fallback;
  const pages: (number | null)[] = [];
  const out = blocks.map((b) => {
    if (b.type !== 'quote') {
      pages.push(null);
      return b;
    }
    const t = takePageToken(b.text);
    if (t.page) last = t.page;
    pages.push(last);
    return t.page ? { ...b, text: t.text } : b;
  });
  return { blocks: out, pages };
}
