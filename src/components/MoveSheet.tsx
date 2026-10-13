'use client';

import { useState } from 'react';

import Sheet from '@/components/Sheet';
import { useLibrary } from '@/contexts/LibraryContext';
import { buildTree, flatten } from '@/lib/outline';
import { viCollator } from '@/lib/vi';
import type { BookRow } from '@/types/legi';

const STATUS_RANK = { reading: 0, later: 1, finished: 2 } as const;

/** Pick a book, then a section. Inbox = bookId null. */
export default function MoveSheet({
  open,
  onClose,
  onPick,
  startBookId,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (bookId: string | null, sectionId: string | null) => void;
  startBookId?: string | null;
}) {
  const { liveBooks, books: all } = useLibrary();
  // Moving inside the book you are reading is the common case: start in its sections.
  const start = startBookId ? (all.get(startBookId) ?? null) : null;
  const [picked, setPicked] = useState<BookRow | null | 'list'>(null);
  const book = picked === 'list' ? null : (picked ?? (start && start.sections.length ? start : null));
  const setBook = (b: BookRow | null) => setPicked(b ?? 'list');
  const books = [...liveBooks].sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || b.lastOpenedAt - a.lastOpenedAt || viCollator.compare(a.title, b.title));

  const close = () => {
    setPicked(null);
    onClose();
  };
  const pick = (bookId: string | null, sectionId: string | null) => {
    onPick(bookId, sectionId);
    close();
  };

  return (
    <Sheet open={open} onClose={close} label="Move to">
      {!book ? (
        <ul className="text-[15px]">
          {books.map((b) => (
            <li key={b.id}>
              <button
                type="button"
                onClick={() => (b.sections.length ? setBook(b) : pick(b.id, null))}
                className={`flex w-full items-baseline justify-between gap-3 py-2.5 text-left ${b.id === startBookId ? 'font-medium text-ink' : 'text-ink'}`}
              >
                <span className="min-w-0 truncate">{b.title}</span>
                {b.sections.length > 0 && <span className="shrink-0 text-[13px] text-faint">›</span>}
              </button>
            </li>
          ))}
          <li>
            <button type="button" onClick={() => pick(null, null)} className="w-full py-2.5 text-left text-muted">
              Inbox
            </button>
          </li>
        </ul>
      ) : (
        <div>
          <div className="mb-2 flex items-baseline justify-between gap-3 text-[13px]">
            <span className="min-w-0 truncate text-faint">{book.title}</span>
            <button type="button" onClick={() => setBook(null)} className="shrink-0 text-faint hover:text-ink">
              other book
            </button>
          </div>
          <ul className="text-[15px]">
            <li>
              <button type="button" onClick={() => pick(book.id, null)} className="w-full py-2.5 text-left text-muted">
                no chapter
              </button>
            </li>
            {flatten(buildTree(book.sections)).map((n) => (
              <li key={n.section.id}>
                <button
                  type="button"
                  onClick={() => pick(book.id, n.section.id)}
                  style={{ paddingLeft: n.depth * 16 }}
                  className={`w-full py-2.5 text-left ${n.depth === 0 ? 'text-ink' : 'text-muted'}`}
                >
                  {n.section.title}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Sheet>
  );
}
