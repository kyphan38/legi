// ============================================================
// legi - Composer draft in localStorage
//
// Written on every keystroke, no debounce: closing the app mid-sentence never
// loses text. Keyed by uid + book ('inbox' for the Inbox). Sign out clears it.
// ============================================================

import { readJson, writeJson } from '@/lib/store';
import type { QuoteKind } from '@/types/legi';

export type Draft = { text: string; note: string; page: string; kind: QuoteKind; at: number };

const PREFIX = 'legi.draft.';

export function readDraft(key: string): Draft | null {
  return readJson<Draft>(PREFIX + key);
}

export function writeDraft(key: string, draft: Draft): void {
  writeJson(PREFIX + key, draft);
}

export function clearDraft(key: string): void {
  writeJson(PREFIX + key, null);
}
