// Book shade on the shelf (1-2 carry ink text, 3-4 carry bg text) and pile sizes.

import { hashString } from '@/lib/daily';

/** Which --spine-N shade. */
export function spineShade(bookId: string): 1 | 2 | 3 | 4 {
  return ((hashString(bookId) % 4) + 1) as 1 | 2 | 3 | 4;
}

/** A book lying in the pile: px height, % width, % shift from the left. */
export function stackSize(bookId: string, quoteCount: number, totalPages: number | null): { height: number; width: number; shift: number } {
  const h = hashString(bookId);
  const height = Math.round(Math.min(48, 28 + 3 * Math.sqrt(Math.max(0, quoteCount))));
  const pages = totalPages ?? 300;
  const width = Math.round(68 + (24 * Math.min(pages, 800)) / 800);
  const shift = Math.min(100 - width, (h >>> 3) % 7);
  return { height, width, shift };
}
