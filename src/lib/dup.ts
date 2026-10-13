// ============================================================
// legi - Duplicate quotes
//
// Trigrams of dupKey() (keeps Vietnamese marks) and the Dice score.
// Similar when dice >= 0.8, or when one fully contains the other and the
// shorter one has >= 20 chars. Only a hint: saving is never blocked.
// ============================================================

import { dupKey } from '@/lib/vi';

export const MIN_CHARS = 20;
const THRESHOLD = 0.8;

export function trigrams(key: string): Set<string> {
  const s = ` ${key} `;
  const out = new Set<string>();
  const chars = Array.from(s);
  for (let i = 0; i + 3 <= chars.length; i++) out.add(chars.slice(i, i + 3).join(''));
  return out;
}

export function dice(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let both = 0;
  const [small, big] = a.size < b.size ? [a, b] : [b, a];
  for (const t of small) if (big.has(t)) both++;
  return (2 * both) / (a.size + b.size);
}

export type Indexed = { id: string; key: string; grams: Set<string> };

export function indexText(id: string, text: string): Indexed {
  const key = dupKey(text);
  return { id, key, grams: trigrams(key) };
}

/** The most similar quote, or null. `index` holds every live quote (see LibraryContext). */
export function findSimilar(text: string, index: Indexed[], excludeId?: string): { id: string; score: number } | null {
  const key = dupKey(text);
  if (Array.from(key).length < MIN_CHARS) return null;
  const grams = trigrams(key);
  let best: { id: string; score: number } | null = null;
  for (const q of index) {
    if (q.id === excludeId || !q.key) continue;
    const short = key.length <= q.key.length ? key : q.key;
    const long = short === key ? q.key : key;
    let score = 0;
    if (short.length >= MIN_CHARS && long.includes(short)) score = 1;
    else {
      const ratio = key.length / q.key.length;
      if (ratio < 0.5 || ratio > 2) continue;
      score = dice(grams, q.grams);
    }
    if (score >= THRESHOLD && (!best || score > best.score)) best = { id: q.id, score };
  }
  return best;
}
