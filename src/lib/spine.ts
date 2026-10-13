// Cover shade on the shelf. 1-2 carry ink text, 3-4 carry bg text.

import { hashString } from '@/lib/daily';

export function spineShade(bookId: string): 1 | 2 | 3 | 4 {
  return ((hashString(bookId) % 4) + 1) as 1 | 2 | 3 | 4;
}
