// Order of quotes inside a section: page ascending (no page last), then the
// order key. The key is createdAt until move up/down sets `order`.

type Sortable = { page: number | null; order?: number; createdAt: number };

export const orderKey = (q: Sortable): number => q.order ?? q.createdAt;

export function compareQuotes(a: Sortable, b: Sortable): number {
  if (a.page !== b.page) {
    if (a.page === null) return 1;
    if (b.page === null) return -1;
    return a.page - b.page;
  }
  return orderKey(a) - orderKey(b) || a.createdAt - b.createdAt;
}

export function sortQuotes<T extends Sortable>(quotes: T[]): T[] {
  return [...quotes].sort(compareQuotes);
}

/** An order value between two neighbors (null = no neighbor on that side). */
export function orderBetween(a: number | null, b: number | null): number {
  if (a === null && b === null) return 1;
  if (a === null) return (b as number) - 1;
  if (b === null) return a + 1;
  return (a + b) / 2;
}

type Movable = Sortable & { id: string; bookId: string | null; sectionId: string | null };

/**
 * New `order` that moves a quote one step up (-1) or down (+1) in a sorted
 * list. Only past a neighbor with the same book, section and page, so page
 * order always holds. Null when there is no such neighbor.
 */
export function orderForStep(list: Movable[], id: string, dir: -1 | 1): number | null {
  const i = list.findIndex((q) => q.id === id);
  if (i < 0) return null;
  const q = list[i];
  const same = (x: Movable | undefined): x is Movable =>
    !!x && x.bookId === q.bookId && x.sectionId === q.sectionId && x.page === q.page;
  const near = list[i + dir];
  if (!same(near)) return null;
  const far = list[i + 2 * dir];
  const farKey = same(far) ? orderKey(far) : null;
  return dir < 0 ? orderBetween(farKey, orderKey(near)) : orderBetween(orderKey(near), farKey);
}
