'use client';

import { useState, type ReactNode } from 'react';

import GrowText, { isComposing } from '@/components/GrowText';
import { useLibrary } from '@/contexts/LibraryContext';
import { bookToMarkdown } from '@/lib/export';
import { trashBook, updateBook } from '@/lib/repo';
import { copyText } from '@/lib/share-file';
import { readJson, writeJson } from '@/lib/store';
import { tidy } from '@/lib/typo';
import type { BookFormat, BookRow, BookStatus } from '@/types/legi';

const STATUSES: BookStatus[] = ['reading', 'finished', 'later'];
const FORMATS: BookFormat[] = ['paper', 'pdf'];

function toPages(v: string): number | null {
  const n = Math.floor(Number(v.replace(/\D/g, '')));
  return n > 0 ? Math.min(20000, n) : null;
}

/** Title, author, progress. Tap the title to edit the book (saved on blur, no save button). */
export default function BookHeader({ uid, book, onDeleted }: { uid: string; book: BookRow; onDeleted: () => void }) {
  const { liveQuotes, quotes } = useLibrary();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [copied, setCopied] = useState(false);
  const count = liveQuotes.filter((q) => q.bookId === book.id).length;

  const setStatus = (status: BookStatus) => {
    if (status === book.status) return;
    const now = Date.now();
    updateBook(uid, book.id, { status, finishedAt: status === 'finished' ? (book.finishedAt ?? now) : book.finishedAt });
  };

  const progress = book.currentPage && book.totalPages ? Math.min(1, book.currentPage / book.totalPages) : null;

  return (
    <header className="mt-8">
      {!editing ? (
        <button type="button" onClick={() => setEditing(true)} className="block w-full text-left">
          <h1 className="text-[26px] leading-tight font-medium tracking-tight text-ink">{book.title}</h1>
          {book.author && <p className="mt-1 text-[15px] text-muted">{book.author}</p>}
        </button>
      ) : (
        <BookForm uid={uid} book={book} onStatus={setStatus} count={count} />
      )}

      {/* One quiet line: how far, only when the book's page count is known. Tap the title for the rest. */}
      {(progress !== null || book.pdfUrl) && (
        <div className="mt-4 flex items-center gap-3 text-[12px] text-faint tabular-nums">
          {progress !== null && (
            <>
              <div className="h-[2px] max-w-40 flex-1 bg-sunk" aria-hidden>
                <div className="h-full bg-muted" style={{ width: `${(progress ?? 0) * 100}%` }} />
              </div>
              <span>
                {book.currentPage} / {book.totalPages}
              </span>
            </>
          )}
          {book.pdfUrl && (
            <a href={book.pdfUrl} target="_blank" rel="noreferrer" className="hover:text-ink">
              pdf
            </a>
          )}
        </div>
      )}

      <Takeaway uid={uid} book={book} />

      {editing && (
        <div className="mt-4 flex flex-wrap items-baseline gap-x-5 gap-y-2 text-[13px] text-faint">
          <button
            type="button"
            onClick={async () => {
              const ok = await copyText(bookToMarkdown(book, [...quotes.values()]));
              setCopied(ok);
              setTimeout(() => setCopied(false), 1500);
            }}
            className="hover:text-ink"
          >
            {copied ? 'copied' : 'copy as markdown'}
          </button>
          {!confirmDelete ? (
            <button type="button" onClick={() => setConfirmDelete(true)} className="hover:text-ink">
              delete book
            </button>
          ) : (
            <span className="flex gap-3 text-muted">
              Delete book and {count} {count === 1 ? 'quote' : 'quotes'}?
              <button
                type="button"
                onClick={() => {
                  trashBook(uid, book, [...quotes.values()]);
                  onDeleted();
                }}
                className="text-ink"
              >
                delete
              </button>
              <button type="button" onClick={() => setConfirmDelete(false)} className="text-faint hover:text-ink">
                cancel
              </button>
            </span>
          )}
          <button type="button" onClick={() => setEditing(false)} className="ml-auto text-ink">
            done
          </button>
        </div>
      )}
    </header>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex items-baseline gap-4 border-b border-line py-2">
      <span className="w-16 shrink-0 text-[13px] text-faint">{label}</span>
      {children}
    </label>
  );
}

function Choice<T extends string>({ label, value, options, onPick }: { label: string; value: T; options: T[]; onPick: (v: T) => void }) {
  return (
    <div className="flex items-baseline gap-4 border-b border-line py-2">
      <span className="w-16 shrink-0 text-[13px] text-faint">{label}</span>
      <div className="flex gap-4 text-[15px]" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button key={o} type="button" role="radio" aria-checked={o === value} onClick={() => onPick(o)} className={o === value ? 'text-ink' : 'text-faint hover:text-muted'}>
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

const inputClass = 'min-w-0 flex-1 bg-transparent text-[16px] text-ink outline-none';

function BookForm({ uid, book, onStatus, count }: { uid: string; book: BookRow; onStatus: (s: BookStatus) => void; count: number }) {
  const [title, setTitle] = useState(book.title);
  const [author, setAuthor] = useState(book.author);
  const [pages, setPages] = useState(book.totalPages ? String(book.totalPages) : '');
  const [pdf, setPdf] = useState(book.pdfUrl ?? '');
  const [at, setAt] = useState(book.currentPage ? String(book.currentPage) : '');

  return (
    <div className="text-[15px]">
      <Field label="title">
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => {
            const t = title.trim();
            if (t && t !== book.title) updateBook(uid, book.id, { title: t.slice(0, 300) });
            else setTitle(book.title);
          }}
          className={inputClass}
        />
      </Field>
      <Field label="author">
        <input
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          onBlur={() => author.trim() !== book.author && updateBook(uid, book.id, { author: author.trim().slice(0, 200) })}
          className={inputClass}
        />
      </Field>
      <Field label="pages">
        <input
          value={pages}
          inputMode="numeric"
          onChange={(e) => setPages(e.target.value.replace(/\D/g, '').slice(0, 5))}
          onBlur={() => toPages(pages) !== book.totalPages && updateBook(uid, book.id, { totalPages: toPages(pages) })}
          className={`${inputClass} tabular-nums`}
        />
      </Field>
      <Field label="at page">
        <input
          value={at}
          inputMode="numeric"
          onChange={(e) => setAt(e.target.value.replace(/\D/g, '').slice(0, 5))}
          onBlur={() => toPages(at) !== book.currentPage && updateBook(uid, book.id, { currentPage: toPages(at) })}
          className={`${inputClass} tabular-nums`}
        />
        <span className="shrink-0 text-[13px] text-faint">
          {count} {count === 1 ? 'quote' : 'quotes'}
        </span>
      </Field>
      <Choice label="format" value={book.format} options={FORMATS} onPick={(format) => updateBook(uid, book.id, { format })} />
      {book.format === 'pdf' && (
        <Field label="pdf link">
          <input
            value={pdf}
            type="url"
            onChange={(e) => setPdf(e.target.value)}
            onBlur={() => {
              const v = pdf.trim().slice(0, 2000) || null;
              if (v !== book.pdfUrl) updateBook(uid, book.id, { pdfUrl: v });
            }}
            className={inputClass}
          />
        </Field>
      )}
      <Choice label="status" value={book.status} options={STATUSES} onPick={onStatus} />
    </div>
  );
}

const SKIP_KEY = (id: string) => `legi.skipTakeaway.${id}`;

/** "What stays with you?" once a book is finished; then the answer under the header. */
function Takeaway({ uid, book }: { uid: string; book: BookRow }) {
  const [skipped, setSkipped] = useState(() => readJson<boolean>(SKIP_KEY(book.id)) === true);
  const [draft, setDraft] = useState<string | null>(null);

  const save = () => {
    const t = tidy(draft ?? '');
    if (t !== (book.takeaway ?? '')) updateBook(uid, book.id, { takeaway: t ? t.slice(0, 2000) : null });
    setDraft(null);
  };

  if (draft !== null || (book.status === 'finished' && book.takeaway === null && !skipped)) {
    const value = draft ?? '';
    return (
      <div className="fade-in mt-6">
        <p className="text-[13px] text-faint">What stays with you?</p>
        <GrowText
          value={value}
          onChange={setDraft}
          onKeyDown={(e) => {
            if (isComposing(e)) return;
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              save();
            }
          }}
          label="What stays with you"
          wrapClassName="quote-text mt-1 text-muted"
        />
        <div className="mt-1 flex gap-4 text-[13px]">
          <button type="button" onClick={save} className="text-ink">
            save
          </button>
          {book.takeaway === null && (
            <button
              type="button"
              onClick={() => {
                writeJson(SKIP_KEY(book.id), true);
                setSkipped(true);
                setDraft(null);
              }}
              className="text-faint hover:text-ink"
            >
              skip
            </button>
          )}
        </div>
      </div>
    );
  }
  if (!book.takeaway) return null;
  return (
    <button type="button" onClick={() => setDraft(book.takeaway ?? '')} className="quote-text mt-6 block w-full text-left text-muted">
      {book.takeaway}
    </button>
  );
}
