// Spine size on the shelf: thickness = how many quotes, height = how many pages.

import { hashString } from '@/lib/daily';

export function spineWidth(quoteCount: number): number {
  return Math.round(Math.min(56, 14 + 6 * Math.sqrt(Math.max(0, quoteCount))));
}

export function spineHeight(totalPages: number | null): number {
  if (totalPages === null) return 160;
  return Math.round(140 + (60 * Math.min(totalPages, 800)) / 800);
}

/** 1..4: which --spine-N shade. 1-2 carry ink text, 3-4 carry bg text. */
export function spineShade(bookId: string): 1 | 2 | 3 | 4 {
  return ((hashString(bookId) % 4) + 1) as 1 | 2 | 3 | 4;
}
