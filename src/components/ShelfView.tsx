'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useSyncExternalStore } from 'react';

import { useUid } from '@/components/AuthGate';
import StatusDot from '@/components/StatusDot';
import TopBar from '@/components/TopBar';
import { useSnapCount } from '@/hooks/useSnapCount';
import { useLibrary } from '@/contexts/LibraryContext';
import { shelfViewStore } from '@/lib/prefs';
import { createBook } from '@/lib/repo';
import { isSource, SOURCE_FORMATS } from '@/lib/source';
import { spineShade, stackSize } from '@/lib/spine';
import type { BookFormat, BookRow, BookStatus } from '@/types/legi';

const SHELVES: BookStatus[] = ['reading', 'finished', 'later'];

export default function ShelfView() {
  const uid = useUid();
  const router = useRouter();
  const { liveBooks, byBook, liveQuotes, loaded } = useLibrary();
  const view = useSyncExternalStore(shelfViewStore.subscribe, shelfViewStore.get, shelfViewStore.getServer);
  const params = useSearchParams();
  const [adding, setAdding] = useState(() => params.get('add') === '1');
  const [title, setTitle] = useState('');
  const [addingSource, setAddingSource] = useState(false);
  const [sourceName, setSourceName] = useState('');
  const [sourceFormat, setSourceFormat] = useState<BookFormat>('video');

  const inbox = byBook.get('')?.length ?? 0;
  const snaps = useSnapCount(uid);
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

  const addSource = () => {
    const t = sourceName.trim();
    if (!t) return;
    const id = createBook(uid, t.slice(0, 300), Date.now(), sourceFormat);
    setSourceName('');
    setAddingSource(false);
    router.push(`/book/?id=${id}`);
  };

  const shelfBooks = liveBooks.filter((b) => !isSource(b));
  const sources = liveBooks.filter(isSource).sort((a, b) => b.lastOpenedAt - a.lastOpenedAt);
  const groups = SHELVES.map((s) => ({
    status: s,
    books: shelfBooks.filter((b) => b.status === s).sort((a, b) => b.lastOpenedAt - a.lastOpenedAt),
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
          {snaps > 0 && (
            <Link href="/capture/?snaps=1" className="hover:text-ink">
              Snaps {snaps}
            </Link>
          )}
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

      {loaded && shelfBooks.length === 0 && <div className="mt-10">{addForm}</div>}

      {groups.map(({ status, books }) =>
        books.length === 0 && !(status === 'reading' && shelfBooks.length > 0) ? null : (
          <section key={status} className="mt-10">
            <h2 className="text-[13px] text-faint">{status}</h2>
            {view === 'shelf' ? (
              <div className="mt-3 flex flex-col gap-[3px] border-b border-line-strong pb-[3px]">
                {books.map((b) => (
                  <StackBook key={b.id} book={b} count={count(b)} />
                ))}
                {status === 'reading' &&
                  (adding ? (
                    <div className="pt-2">{addForm}</div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setAdding(true)}
                      aria-label="New book"
                      className="flex h-8 w-[72%] items-center rounded-[2px] border border-dashed border-line-strong px-3 text-[13px] text-faint transition-transform duration-150 hover:translate-x-1 hover:text-ink"
                    >
                      + book
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

      {/* Quotes from outside books: channels, sites, people. A plain list, never a stack. */}
      {loaded && (
        <section className="mt-10">
          <h2 className="text-[13px] text-faint">elsewhere</h2>
          <ul className="mt-2">
            {sources.map((b) => (
              <li key={b.id}>
                <Link href={`/book/?id=${b.id}`} className="block py-2.5">
                  <span className="block text-[16px] text-ink">{b.title}</span>
                  <span className="block text-[13px] text-faint">{[b.author, b.format, `${count(b)} ${count(b) === 1 ? 'quote' : 'quotes'}`].filter(Boolean).join(' · ')}</span>
                </Link>
              </li>
            ))}
            <li className="pt-2">
              {addingSource ? (
                <div>
                  <input
                    autoFocus
                    value={sourceName}
                    onChange={(e) => setSourceName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.nativeEvent.isComposing || e.keyCode === 229) return;
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addSource();
                      } else if (e.key === 'Escape') setAddingSource(false);
                    }}
                    placeholder="Channel, site or person"
                    aria-label="Source name"
                    lang="vi"
                    spellCheck={false}
                    className="w-full border-b border-line-strong bg-transparent py-2 text-[16px] text-ink outline-none placeholder:text-faint"
                  />
                  <div className="mt-2 flex gap-4 text-[13px]" role="radiogroup" aria-label="Kind of source">
                    {SOURCE_FORMATS.map((f) => (
                      <button key={f} type="button" role="radio" aria-checked={sourceFormat === f} onClick={() => setSourceFormat(f)} className={sourceFormat === f ? 'text-ink' : 'text-faint hover:text-muted'}>
                        {f}
                      </button>
                    ))}
                    <button type="button" onClick={addSource} className="ml-auto text-ink">
                      add
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => setAddingSource(true)} className="py-2 text-[14px] text-faint hover:text-ink">
                  + source
                </button>
              )}
            </li>
          </ul>
        </section>
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

/**
 * A book lying in a pile: the spine faces you and reads left to right (an
 * upright spine's vertical title was hard to read). Thicker = more quotes,
 * longer = more pages, a small sideways shift so the pile looks stacked.
 */
function StackBook({ book, count }: { book: BookRow; count: number }) {
  const shade = spineShade(book.id);
  const dark = shade >= 3;
  const { height, width, shift } = stackSize(book.id, count, book.totalPages);
  return (
    <Link
      href={`/book/?id=${book.id}`}
      aria-label={`${book.title}, ${count} ${count === 1 ? 'quote' : 'quotes'}`}
      className="flex items-center gap-3 rounded-[2px] px-3 transition-transform duration-150 ease-[var(--ease-soft)] hover:translate-x-1 focus-visible:translate-x-1"
      style={{ height, width: `${width}%`, marginLeft: `${shift}%`, background: `var(--spine-${shade})`, color: dark ? 'var(--bg)' : 'var(--ink)' }}
    >
      <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{book.title}</span>
      {book.author && <span className="hidden max-w-[40%] shrink-0 truncate text-[11px] opacity-70 sm:inline">{book.author}</span>}
    </Link>
  );
}
