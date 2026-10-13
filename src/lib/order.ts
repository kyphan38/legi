// Order of quotes inside a section: page ascending (no page last), then the
// time they were written. No manual reordering on purpose.

type Sortable = { page: number | null; createdAt: number };

export function compareQuotes(a: Sortable, b: Sortable): number {
  if (a.page !== b.page) {
    if (a.page === null) return 1;
    if (b.page === null) return -1;
    return a.page - b.page;
  }
  return a.createdAt - b.createdAt;
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
