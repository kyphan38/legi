// ============================================================
// legi - All Firestore writes
//
// Rule: never await a write in the UI. Offline, the promise only settles when
// the network is back. Writes go to the persistent cache at once; the save dot
// reads snapshot.metadata.hasPendingWrites. Errors are only logged.
//
// Delete, move, merge and split push an undo entry.
// ============================================================

import { collection, deleteDoc, doc, setDoc, updateDoc, writeBatch, type WriteBatch } from 'firebase/firestore';

import { getDb } from '@/lib/firebase-client';
import { mergeFields, splitText } from '@/lib/quote-ops';
import { purgeable, trashedWith } from '@/lib/trash';
import { pushUndo } from '@/lib/undo';
import type { Book, BookFormat, BookRow, DailyPick, Quote, QuoteKind, QuoteRow, QuoteSource } from '@/types/legi';

const warn = (what: string) => (err: unknown) => console.warn(`[repo] ${what} failed`, err);

const booksCol = (uid: string) => collection(getDb(), 'users', uid, 'books');
const quotesCol = (uid: string) => collection(getDb(), 'users', uid, 'quotes');
const bookRef = (uid: string, id: string) => doc(getDb(), 'users', uid, 'books', id);
const quoteRef = (uid: string, id: string) => doc(getDb(), 'users', uid, 'quotes', id);

/** Firestore batches hold at most 500 writes. */
function inBatches<T>(items: T[], write: (b: WriteBatch, item: T) => void, what: string): void {
  for (let i = 0; i < items.length; i += 450) {
    const b = writeBatch(getDb());
    items.slice(i, i + 450).forEach((item) => write(b, item));
    b.commit().catch(warn(what));
  }
}

function strip<T extends { id: string }>(row: T): Omit<T, 'id'> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, ...rest } = row;
  return rest;
}

// ---------- books ----------

export function newBookId(uid: string): string {
  return doc(booksCol(uid)).id;
}

export function createBook(uid: string, title: string, now = Date.now(), format: BookFormat = 'paper'): string {
  const id = newBookId(uid);
  const book: Book = {
    title: title.trim(),
    author: '',
    status: 'reading',
    format,
    totalPages: null,
    currentPage: null,
    pdfUrl: null,
    takeaway: null,
    sections: [],
    startedAt: now,
    finishedAt: null,
    lastOpenedAt: now,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  setDoc(bookRef(uid, id), book).catch(warn('createBook'));
  return id;
}

export function updateBook(uid: string, id: string, patch: Partial<Book>, now = Date.now()): void {
  updateDoc(bookRef(uid, id), { ...patch, updatedAt: now }).catch(warn('updateBook'));
}

/** Book and all its quotes go to Trash with one timestamp, so restore brings back exactly those. */
export function trashBook(uid: string, book: BookRow, quotes: QuoteRow[], now = Date.now()): void {
  const live = quotes.filter((q) => q.bookId === book.id && q.deletedAt === null);
  updateBook(uid, book.id, { deletedAt: now }, now);
  inBatches(live, (b, q) => b.update(quoteRef(uid, q.id), { deletedAt: now, trashedWithBook: true, updatedAt: now }), 'trashBook');
  pushUndo('Deleted', () => restoreBook(uid, { ...book, deletedAt: now }, live.map((q) => ({ ...q, deletedAt: now, trashedWithBook: true }))));
}

export function restoreBook(uid: string, book: BookRow, quotes: QuoteRow[], now = Date.now()): void {
  if (book.deletedAt === null) return;
  const back = trashedWith(quotes, book.id, book.deletedAt);
  updateBook(uid, book.id, { deletedAt: null }, now);
  inBatches(back, (b, q) => b.update(quoteRef(uid, q.id), { deletedAt: null, trashedWithBook: false, updatedAt: now }), 'restoreBook');
}

// ---------- quotes ----------

export type QuoteInput = {
  bookId: string | null;
  sectionId: string | null;
  kind: QuoteKind;
  text: string;
  note: string;
  page: number | null;
  source: QuoteSource;
};

export function buildQuote(input: QuoteInput, now: number): Quote {
  return {
    ...input,
    favorite: false,
    answeredBy: null,
    shownCount: 0,
    lastShownAt: null,
    trashedWithBook: false,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

export function newQuoteId(uid: string): string {
  return doc(quotesCol(uid)).id;
}

export function createQuote(uid: string, input: QuoteInput, now = Date.now()): string {
  const id = newQuoteId(uid);
  setDoc(quoteRef(uid, id), buildQuote(input, now)).catch(warn('createQuote'));
  return id;
}

/** Several quotes in one batch (paste, OCR). createdAt +10ms each keeps their order and leaves room for a split (+1). */
export function createQuotes(uid: string, inputs: QuoteInput[], now = Date.now()): string[] {
  const rows = inputs.map((input, i) => ({ id: newQuoteId(uid), q: buildQuote(input, now + i * 10) }));
  inBatches(rows, (b, r) => b.set(quoteRef(uid, r.id), r.q), 'createQuotes');
  return rows.map((r) => r.id);
}

export function updateQuote(uid: string, id: string, patch: Partial<Quote>, now = Date.now()): void {
  updateDoc(quoteRef(uid, id), { ...patch, updatedAt: now }).catch(warn('updateQuote'));
}

export function trashQuotes(uid: string, ids: string[], opts: { undo?: boolean } = {}, now = Date.now()): void {
  inBatches(ids, (b, id) => b.update(quoteRef(uid, id), { deletedAt: now, trashedWithBook: false, updatedAt: now }), 'trashQuotes');
  if (opts.undo !== false) pushUndo('Deleted', () => restoreQuotes(uid, ids));
}

export function restoreQuotes(uid: string, ids: string[], now = Date.now()): void {
  inBatches(ids, (b, id) => b.update(quoteRef(uid, id), { deletedAt: null, trashedWithBook: false, updatedAt: now }), 'restoreQuotes');
}

export function moveQuotes(uid: string, rows: QuoteRow[], bookId: string | null, sectionId: string | null, now = Date.now()): void {
  const before = rows.map((q) => ({ id: q.id, bookId: q.bookId, sectionId: q.sectionId }));
  inBatches(rows, (b, q) => b.update(quoteRef(uid, q.id), { bookId, sectionId, updatedAt: now }), 'moveQuotes');
  pushUndo('Moved', () =>
    inBatches(before, (b, q) => b.update(quoteRef(uid, q.id), { bookId: q.bookId, sectionId: q.sectionId, updatedAt: Date.now() }), 'undoMove'),
  );
}

/** Each quote to its own section in the same book, with one undo. */
export function placeQuotes(uid: string, moves: { quote: QuoteRow; sectionId: string }[], now = Date.now()): void {
  if (moves.length === 0) return;
  const before = moves.map(({ quote }) => ({ id: quote.id, sectionId: quote.sectionId }));
  inBatches(moves, (b, m) => b.update(quoteRef(uid, m.quote.id), { sectionId: m.sectionId, updatedAt: now }), 'placeQuotes');
  pushUndo('Moved', () => inBatches(before, (b, q) => b.update(quoteRef(uid, q.id), { sectionId: q.sectionId, updatedAt: Date.now() }), 'undoPlace'));
}

/** rows in display order. Keeps the first id; the others go to Trash. */
export function mergeQuotes(uid: string, rows: QuoteRow[], now = Date.now()): void {
  if (rows.length < 2) return;
  const [first, ...rest] = rows;
  const merged = mergeFields(rows);
  const b = writeBatch(getDb());
  b.update(quoteRef(uid, first.id), { ...merged, updatedAt: now });
  rest.forEach((q) => b.update(quoteRef(uid, q.id), { deletedAt: now, trashedWithBook: false, updatedAt: now }));
  b.commit().catch(warn('mergeQuotes'));
  pushUndo('Merged', () => {
    const u = writeBatch(getDb());
    const t = Date.now();
    u.update(quoteRef(uid, first.id), { text: first.text, note: first.note, page: first.page, favorite: first.favorite, updatedAt: t });
    rest.forEach((q) => u.update(quoteRef(uid, q.id), { deletedAt: null, updatedAt: t }));
    u.commit().catch(warn('undoMerge'));
  });
}

/** Splits at the caret. The new quote keeps book, section, page and kind; the note stays on the first. */
export function splitQuote(uid: string, row: QuoteRow, at: number, now = Date.now()): string | null {
  const parts = splitText(row.text, at);
  if (!parts) return null;
  const id = newQuoteId(uid);
  const b = writeBatch(getDb());
  b.update(quoteRef(uid, row.id), { text: parts[0], updatedAt: now });
  b.set(
    quoteRef(uid, id),
    buildQuote(
      { bookId: row.bookId, sectionId: row.sectionId, kind: row.kind, text: parts[1], note: '', page: row.page, source: row.source },
      row.createdAt + 1,
    ),
  );
  b.commit().catch(warn('splitQuote'));
  pushUndo('Split', () => {
    const u = writeBatch(getDb());
    const t = Date.now();
    u.update(quoteRef(uid, row.id), { text: row.text, updatedAt: t });
    u.update(quoteRef(uid, id), { deletedAt: t, updatedAt: t });
    u.commit().catch(warn('undoSplit'));
  });
  return id;
}

// ---------- trash ----------

/** Deletes for good what has been in Trash > 30 days. The rules check the same. */
export function purgeTrash(uid: string, books: BookRow[], quotes: QuoteRow[], now = Date.now()): number {
  const b = purgeable(books, now);
  const q = purgeable(quotes, now);
  b.forEach((x) => deleteDoc(bookRef(uid, x.id)).catch(warn('purge book')));
  q.forEach((x) => deleteDoc(quoteRef(uid, x.id)).catch(warn('purge quote')));
  return b.length + q.length;
}

// ---------- daily ----------

/**
 * Creates daily/{day} and counts the showing in one batch. If another device
 * already picked, the rules refuse the create and the batch fails as a whole.
 */
export function saveDaily(uid: string, day: string, quote: QuoteRow, now = Date.now()): void {
  const b = writeBatch(getDb());
  const pick: DailyPick = { quoteId: quote.id, createdAt: now };
  b.set(doc(getDb(), 'users', uid, 'daily', day), pick);
  b.update(quoteRef(uid, quote.id), { shownCount: quote.shownCount + 1, lastShownAt: now, updatedAt: now });
  b.commit().catch(warn('saveDaily'));
}

export function rowData<T extends { id: string }>(row: T): Omit<T, 'id'> {
  return strip(row);
}
