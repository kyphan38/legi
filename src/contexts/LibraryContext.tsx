'use client';

// ============================================================
// legi - Every book and quote, in memory
//
// One snapshot listener per collection, cache-first thanks to the persistent
// cache. Search, duplicate checks and the Daily quote then run offline on
// plain arrays. ~5,000 quotes x ~400 bytes = 2 MB: fine. Revisit past 10,000.
// ============================================================

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';

import { useUid } from '@/components/AuthGate';
import { dayOf } from '@/lib/day';
import { indexText, type Indexed } from '@/lib/dup';
import { getDb } from '@/lib/firebase-client';
import { sortQuotes } from '@/lib/order';
import { purgeTrash } from '@/lib/repo';
import type { Book, BookRow, Quote, QuoteRow } from '@/types/legi';

type Library = {
  books: Map<string, BookRow>;
  quotes: Map<string, QuoteRow>;
  /** Live books (not in Trash). */
  liveBooks: BookRow[];
  /** Live quotes per book id ('' = Inbox), sorted by page then time. */
  byBook: Map<string, QuoteRow[]>;
  /** All live quotes. */
  liveQuotes: QuoteRow[];
  /** Trigram index of live quotes, for duplicate hints. */
  dupIndex: Indexed[];
  /** A write is waiting for the server (offline or in flight). */
  pending: boolean;
  /** Both collections have their first snapshot. */
  loaded: boolean;
};

const LibraryContext = createContext<Library | null>(null);

const PURGED_KEY = 'legi.purgedAt';

// Trigrams per quote, rebuilt only when its text changes.
const gramCache = new Map<string, { text: string; item: Indexed }>();
function indexed(q: QuoteRow): Indexed {
  const hit = gramCache.get(q.id);
  if (hit && hit.text === q.text) return hit.item;
  const item = indexText(q.id, q.text);
  gramCache.set(q.id, { text: q.text, item });
  return item;
}

export function LibraryProvider({ children }: { children: ReactNode }) {
  const uid = useUid();
  const [books, setBooks] = useState<Map<string, BookRow>>(() => new Map());
  const [quotes, setQuotes] = useState<Map<string, QuoteRow>>(() => new Map());
  const [pendingBooks, setPendingBooks] = useState(false);
  const [pendingQuotes, setPendingQuotes] = useState(false);
  const [loadedBooks, setLoadedBooks] = useState(false);
  const [loadedQuotes, setLoadedQuotes] = useState(false);

  useEffect(() => {
    const db = getDb();
    const offBooks = onSnapshot(
      collection(db, 'users', uid, 'books'),
      { includeMetadataChanges: true },
      (snap) => {
        const next = new Map<string, BookRow>();
        snap.forEach((d) => next.set(d.id, { id: d.id, ...(d.data() as Book) }));
        setBooks(next);
        setPendingBooks(snap.metadata.hasPendingWrites);
        setLoadedBooks(true);
      },
      (err) => console.warn('[library] books listener failed', err),
    );
    const offQuotes = onSnapshot(
      collection(db, 'users', uid, 'quotes'),
      { includeMetadataChanges: true },
      (snap) => {
        const next = new Map<string, QuoteRow>();
        snap.forEach((d) => next.set(d.id, { id: d.id, ...(d.data() as Quote) }));
        setQuotes(next);
        setPendingQuotes(snap.metadata.hasPendingWrites);
        setLoadedQuotes(true);
      },
      (err) => console.warn('[library] quotes listener failed', err),
    );
    return () => {
      offBooks();
      offQuotes();
    };
  }, [uid]);

  const loaded = loadedBooks && loadedQuotes;

  // Trash older than 30 days goes for good: once a day, after the first load.
  useEffect(() => {
    if (!loaded) return;
    const today = dayOf(Date.now());
    try {
      if (localStorage.getItem(PURGED_KEY) === today) return;
      localStorage.setItem(PURGED_KEY, today);
    } catch {
      return;
    }
    purgeTrash(uid, [...books.values()], [...quotes.values()]);
  }, [loaded, uid, books, quotes]);

  const value = useMemo<Library>(() => {
    const liveBooks = [...books.values()].filter((b) => b.deletedAt === null);
    const liveIds = new Set(liveBooks.map((b) => b.id));
    const liveQuotes = sortQuotes(
      [...quotes.values()].filter((q) => q.deletedAt === null && (q.bookId === null || liveIds.has(q.bookId))),
    );
    const byBook = new Map<string, QuoteRow[]>();
    for (const q of liveQuotes) {
      const key = q.bookId ?? '';
      const list = byBook.get(key);
      if (list) list.push(q);
      else byBook.set(key, [q]);
    }
    const dupIndex = liveQuotes.map(indexed);
    return { books, quotes, liveBooks, liveQuotes, byBook, dupIndex, pending: pendingBooks || pendingQuotes, loaded };
  }, [books, quotes, pendingBooks, pendingQuotes, loaded]);

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export function useLibrary(): Library {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error('useLibrary must be used inside <LibraryProvider>.');
  return ctx;
}
