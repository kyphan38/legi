'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useSyncExternalStore } from 'react';

import { useUid } from '@/components/AuthGate';
import StatusDot from '@/components/StatusDot';
import TopBar from '@/components/TopBar';
import { useLibrary } from '@/contexts/LibraryContext';
import { shelfViewStore } from '@/lib/prefs';
import { createBook } from '@/lib/repo';
import { spineHeight, spineShade, spineWidth } from '@/lib/spine';
import type { BookRow, BookStatus } from '@/types/legi';

const SHELVES: BookStatus[] = ['reading', 'finished', 'later'];

export default function ShelfView() {
  const uid = useUid();
  const router = useRouter();
  const { liveBooks, byBook, liveQuotes, loaded } = useLibrary();
  const view = useSyncExternalStore(shelfViewStore.subscribe, shelfViewStore.get, shelfViewStore.getServer);
  const params = useSearchParams();
  const [adding, setAdding] = useState(() => params.get('add') === '1');
  const [title, setTitle] = useState('');

  const inbox = byBook.get('')?.length ?? 0;
  const questions = liveQuotes.filter((q) => q.kind === 'question' && q.answeredBy === null).length;
  const count = (b: BookRow) => byBook.get(b.id)?.length ?? 0;

  const add = () => {
    const t = title.trim();
    if (!t) return;
    const id = createBook(uid, t.slice(0, 300));
    setTitle('');
    setAdding(false);
    router.push(`/book/?id=${id}&new=1`);
  };

  const groups = SHELVES.map((s) => ({
    status: s,
    books: liveBooks.filter((b) => b.status === s).sort((a, b) => b.lastOpenedAt - a.lastOpenedAt),
  }));

  const addForm = (
    <input
      autoFocus
      value={title}
      onChange={(e) => setTitle(e.target.value)}
      onKeyDown={(e) => {
        if (e.nativeEvent.isComposing || e.keyCode === 229) return;
        if (e.key === 'Enter') {
          e.preventDefault();
          add();
        } else if (e.key === 'Escape') setAdding(false);
      }}
      onBlur={() => !title.trim() && setAdding(false)}
      placeholder="Book title"
      aria-label="Book title"
      spellCheck={false}
      className="w-full border-b border-line-strong bg-transparent py-2 text-[16px] text-ink outline-none placeholder:text-faint"
    />
  );

  return (
    <main className="paper pb-24">
      <TopBar current="shelf" />

      <div className="mt-8 flex items-baseline gap-4 text-[13px] text-faint">
        <div className="flex gap-3" role="radiogroup" aria-label="View">
          {(['shelf', 'list'] as const).map((v) => (
            <button key={v} type="button" role="radio" aria-checked={view === v} onClick={() => shelfViewStore.set(v)} className={view === v ? 'text-ink' : 'hover:text-muted'}>
              {v}
            </button>
          ))}
        </div>
        <div className="ml-auto flex gap-4">
          {questions > 0 && (
            <Link href="/questions/" className="hover:text-ink">
              questions {questions}
            </Link>
          )}
          {inbox > 0 && (
            <Link href="/inbox/" className="hover:text-ink">
              Inbox {inbox}
            </Link>
          )}
        </div>
      </div>

      {loaded && liveBooks.length === 0 && <div className="mt-10">{addForm}</div>}

      {groups.map(({ status, books }) =>
        books.length === 0 && !(status === 'reading' && liveBooks.length > 0) ? null : (
          <section key={status} className="mt-10">
            <h2 className="text-[13px] text-faint">{status}</h2>
            {view === 'shelf' ? (
              <div className="mt-3 flex flex-wrap items-end gap-1 border-b border-line-strong">
                {books.map((b) => (
                  <Spine key={b.id} book={b} count={count(b)} />
                ))}
                {status === 'reading' &&
                  (adding ? (
                    <div className="mb-2 ml-2 min-w-40 flex-1">{addForm}</div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setAdding(true)}
                      aria-label="New book"
                      className="flex h-[160px] w-[22px] items-center justify-center rounded-t-[3px] border border-b-0 border-dashed border-line-strong text-faint transition-transform duration-150 hover:-translate-y-1 hover:text-ink"
                    >
                      +
                    </button>
                  ))}
              </div>
            ) : (
              <ul className="mt-2">
                {books.map((b) => (
                  <li key={b.id}>
                    <Link href={`/book/?id=${b.id}`} className="block py-2.5">
                      <span className="block text-[16px] text-ink">{b.title}</span>
                      <span className="block text-[13px] text-faint">
                        {[b.author, `${count(b)} ${count(b) === 1 ? 'quote' : 'quotes'}`].filter(Boolean).join(' · ')}
                      </span>
                    </Link>
                  </li>
                ))}
                {status === 'reading' && (
                  <li className="pt-2">
                    {adding ? (
                      addForm
                    ) : (
                      <button type="button" onClick={() => setAdding(true)} className="py-2 text-[14px] text-faint hover:text-ink">
                        + book
                      </button>
                    )}
                  </li>
                )}
              </ul>
            )}
          </section>
        ),
      )}

      <div className="mt-14 flex gap-4 text-[13px] text-faint">
        <Link href="/trash/" className="hover:text-ink">
          trash
        </Link>
      </div>
      <StatusDot />
    </main>
  );
}

function Spine({ book, count }: { book: BookRow; count: number }) {
  const shade = spineShade(book.id);
  const dark = shade >= 3;
  return (
    <Link
      href={`/book/?id=${book.id}`}
      aria-label={`${book.title}, ${count} ${count === 1 ? 'quote' : 'quotes'}`}
      title={book.title}
      className="flex shrink-0 justify-center overflow-hidden rounded-t-[3px] px-1 py-2.5 transition-transform duration-150 ease-[var(--ease-soft)] hover:-translate-y-1 focus-visible:-translate-y-1"
      style={{
        width: spineWidth(count),
        height: spineHeight(book.totalPages),
        background: `var(--spine-${shade})`,
        color: dark ? 'var(--bg)' : 'var(--ink)',
      }}
    >
      <span className="truncate text-[12px] leading-none [writing-mode:vertical-rl]">{book.title}</span>
    </Link>
  );
}
