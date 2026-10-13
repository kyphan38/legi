// Trash keeps items 30 days. Same number as purgeable() in firestore.rules.

export const TRASH_DAYS = 30;
export const TRASH_MS = TRASH_DAYS * 24 * 60 * 60 * 1000;

type Trashable = { id: string; deletedAt: number | null };

/** Whole days left before the item is removed for good (never below 0). */
export function daysLeft(deletedAt: number, now: number): number {
  return Math.max(0, Math.ceil((deletedAt + TRASH_MS - now) / 86_400_000));
}

/** Items the rules let us delete for good. A small margin avoids a clock-skew refusal. */
export function purgeable<T extends Trashable>(items: T[], now: number): T[] {
  return items.filter((x) => x.deletedAt !== null && now - x.deletedAt > TRASH_MS + 60_000);
}

/** Quotes that went to Trash together with this book (same timestamp). */
export function trashedWith<T extends { bookId: string | null; trashedWithBook: boolean; deletedAt: number | null }>(
  quotes: T[],
  bookId: string,
  bookDeletedAt: number,
): T[] {
  return quotes.filter((q) => q.bookId === bookId && q.trashedWithBook && q.deletedAt === bookDeletedAt);
}
