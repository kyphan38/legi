// ============================================================
// legi - Cloud Function calls (AI)
//
// Components call these instead of httpsCallable, so the function
// names, payloads and timeouts live in one place.
// ============================================================

import { httpsCallable } from 'firebase/functions';

import { getFunctionsClient } from '@/lib/firebase-client';
import type { PageResult } from '@/lib/capture';
import type { TocItem } from '@/lib/outline';

/** Audio files can be long; the default 70s is too short. */
const TIMEOUT_MS = 120_000;

function callable<Req, Res>(name: string) {
  return httpsCallable<Req, Res>(getFunctionsClient(), name, { timeout: TIMEOUT_MS });
}

/** Speech to text. Returns '' when nothing was heard. */
export async function transcribe(audio: string, mimeType: string): Promise<string> {
  const res = await callable<{ audio: string; mimeType: string }, { text: string }>('transcribe')({ audio, mimeType });
  return res.data.text;
}

export type OutlineEntry = { id: string; title: string; depth: number; page: number | null };

/** Sections said aloud, placed against the current outline. */
export async function tocFromVoice(audio: string, mimeType: string, outline: OutlineEntry[]): Promise<TocItem[]> {
  const res = await callable<{ audio: string; mimeType: string; outline: OutlineEntry[] }, { items: TocItem[] }>('tocFromVoice')({
    audio,
    mimeType,
    outline,
  });
  return res.data.items ?? [];
}

/** Passages read from book page photos (base64). */
export async function extractPage(images: string[], mode: 'marked' | 'all'): Promise<PageResult[]> {
  const res = await callable<{ images: string[]; mode: 'marked' | 'all' }, { pages: PageResult[] }>('extractPage')({ images, mode });
  return res.data.pages;
}

export type MeaningHit = { id: string; score: number };

/** Quotes close in meaning to the query, best first. `partial`: the index is still being built. */
export async function searchMeaning(query: string): Promise<{ hits: MeaningHit[]; partial: boolean }> {
  const res = await callable<{ query: string }, { hits: MeaningHit[]; partial: boolean }>('searchMeaning')({ query });
  return { hits: res.data.hits ?? [], partial: !!res.data.partial };
}
