'use client';

import { useState } from 'react';

import { useUid } from '@/components/AuthGate';
import TopBar from '@/components/TopBar';
import { useLibrary } from '@/contexts/LibraryContext';
import { restoreBook, restoreQuotes } from '@/lib/repo';
import { daysLeft } from '@/lib/trash';

/** Deleted books and quotes, newest first. Restore only: they leave for good after 30 days. */
export default function TrashView() {
  const uid = useUid();
  const { books, quotes, loaded } = useLibrary();
  const [now] = useState(() => Date.now());
  const all = [...quotes.values()];

  const trashedBooks = [...books.values()].filter((b) => b.deletedAt !== null);
  // Quotes trashed with their book are restored with it, not one by one.
  const trashedQuotes = all.filter((q) => q.deletedAt !== null && (!q.trashedWithBook || !q.bookId || books.get(q.bookId)?.deletedAt == null));
  const items = [
    ...trashedBooks.map((b) => ({ kind: 'book' as const, at: b.deletedAt as number, book: b })),
    ...trashedQuotes.map((q) => ({ kind: 'quote' as const, at: q.deletedAt as number, quote: q })),
  ].sort((a, b) => b.at - a.at);

  return (
    <main className="paper pb-24">
      <TopBar current={null} />
      <h1 className="mt-8 text-[15px] font-medium text-ink">Trash</h1>
      {loaded && items.length === 0 && <p className="mt-6 text-[14px] text-faint">Empty.</p>}
      <ul className="mt-6 space-y-5">
        {items.map((it) => {
          const left = daysLeft(it.at, now);
          if (it.kind === 'book') {
            const n = all.filter((q) => q.bookId === it.book.id && q.trashedWithBook && q.deletedAt === it.book.deletedAt).length;
            return (
              <li key={`b-${it.book.id}`} className="flex items-baseline gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-[16px] text-ink">{it.book.title}</p>
                  <p className="text-[13px] text-faint">
                    book · {n} {n === 1 ? 'quote' : 'quotes'} · {left} {left === 1 ? 'day' : 'days'}
                  </p>
                </div>
                <button type="button" onClick={() => restoreBook(uid, it.book, all)} className="shrink-0 text-[13px] text-ink">
                  restore
                </button>
              </li>
            );
          }
          const book = it.quote.bookId ? books.get(it.quote.bookId) : null;
          return (
            <li key={`q-${it.quote.id}`} className="flex items-baseline gap-4">
              <div className="min-w-0 flex-1">
                <p className={`line-clamp-3 ${it.quote.kind === 'quote' ? 'font-serif' : ''} text-[16px] leading-relaxed text-muted`}>{it.quote.text.replace(/\*\*/g, '')}</p>
                <p className="text-[13px] text-faint">
                  {book?.title ?? 'Inbox'} · {left} {left === 1 ? 'day' : 'days'}
                </p>
              </div>
              <button type="button" onClick={() => restoreQuotes(uid, [it.quote.id])} className="shrink-0 text-[13px] text-ink">
                restore
              </button>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
