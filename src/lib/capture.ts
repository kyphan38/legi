// ============================================================
// legi - Photo capture: shared state and pure helpers
//
// The composer hands photos to /capture/ through captureStore (same tab, no
// reload), so nothing big goes into the URL or localStorage.
// ============================================================

import { dice, trigrams } from '@/lib/dup';
import { sectionForPage } from '@/lib/outline';
import { memoryStore } from '@/lib/store';
import { fold } from '@/lib/vi';
import type { Section } from '@/types/legi';

export type Passage = { text: string; marked: boolean };
export type PageResult = { page: number | null; runningHead: string | null; passages: Passage[] };

export type CaptureItem = {
  key: string;
  /** Set when the photo came from the snap queue (deleted after save). */
  snapId: string | null;
  bookId: string | null;
  sectionId: string | null;
  blob: Blob;
  mode: 'marked' | 'all';
  status: 'reading' | 'done' | 'error';
  pages: PageResult[];
};

export const captureStore = memoryStore<CaptureItem[]>([]);

const HEAD_MATCH = 0.6;

/**
 * Where a photographed page goes: by its printed page when sections have first
 * pages (exact), else the section whose title looks like the running head,
 * else the fallback.
 */
export function guessSection(runningHead: string | null, sections: Section[], fallback: string | null, page: number | null = null): string | null {
  const byPage = sectionForPage(sections, page);
  if (byPage) return byPage;
  if (!runningHead) return fallback;
  const head = trigrams(fold(runningHead));
  let best: { id: string; score: number } | null = null;
  for (const s of sections) {
    const score = dice(head, trigrams(fold(s.title)));
    if (score >= HEAD_MATCH && (!best || score > best.score)) best = { id: s.id, score };
  }
  return best?.id ?? fallback;
}

/** Which passages start ticked: marked ones that are not saved already. */
export function initialPicks(passages: Passage[], isDuplicate: (text: string) => boolean): boolean[] {
  return passages.map((p) => p.marked && !isDuplicate(p.text));
}
