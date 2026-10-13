'use client';

// ============================================================
// legi - Review what the model read from page photos
//
// /capture/          photos just taken (from the composer)
// /capture/?snaps=1  photos saved for later on this device
// Marked passages start ticked; ones already saved say "already saved".
// ============================================================

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { httpsCallable } from 'firebase/functions';

import { useUid } from '@/components/AuthGate';
import GrowText from '@/components/GrowText';
import SectionPicker from '@/components/SectionPicker';
import TopBar from '@/components/TopBar';
import { useLibrary } from '@/contexts/LibraryContext';
import { captureStore, guessSection, initialPicks, type CaptureItem, type PageResult } from '@/lib/capture';
import { findSimilar } from '@/lib/dup';
import { getFunctionsClient } from '@/lib/firebase-client';
import { blobToBase64 } from '@/lib/image';
import { pathOf } from '@/lib/outline';
import { createQuotes, updateBook, type QuoteInput } from '@/lib/repo';
import { addSnap, deleteSnap, listSnaps } from '@/lib/snaps';
import { tidy } from '@/lib/typo';

type Row = { text: string; picked: boolean; dup: boolean };
type PageState = { page: string; sectionId: string | null; rows: Row[] };

async function readPhoto(item: CaptureItem): Promise<PageResult[]> {
  const call = httpsCallable<{ images: string[]; mode: 'marked' | 'all' }, { pages: PageResult[] }>(getFunctionsClient(), 'extractPage', { timeout: 120_000 });
  const res = await call({ images: [await blobToBase64(item.blob)], mode: item.mode });
  return res.data.pages;
}

export default function CaptureView() {
  const uid = useUid();
  const params = useSearchParams();
  const fromSnaps = params.get('snaps') === '1';
  const items = useSyncExternalStore(captureStore.subscribe, captureStore.get, captureStore.getServer);
  const busy = useRef(false);

  // Load the snap queue once.
  useEffect(() => {
    if (!fromSnaps) return;
    void listSnaps(uid).then((snaps) =>
      captureStore.set(
        snaps.map((s) => ({ key: s.id, snapId: s.id, bookId: s.bookId, sectionId: s.sectionId, blob: s.blob, mode: 'marked', status: navigator.onLine ? 'reading' : 'error', pages: [] })),
      ),
    );
  }, [fromSnaps, uid]);

  // Read photos one by one.
  useEffect(() => {
    if (busy.current) return;
    const next = items.find((i) => i.status === 'reading');
    if (!next) return;
    busy.current = true;
    readPhoto(next)
      .then((pages) => update(next.key, { status: 'done', pages }))
      .catch((err) => {
        console.warn('[capture] read failed', err);
        update(next.key, { status: 'error' });
      })
      .finally(() => {
        busy.current = false;
        captureStore.set([...captureStore.get()]);
      });
  }, [items]);

  return (
    <main className="paper pb-24">
      <TopBar current={null} />
      <h1 className="mt-8 text-[15px] font-medium text-ink">{fromSnaps ? 'Snaps' : 'Photos'}</h1>
      {items.length === 0 && <p className="mt-6 text-[14px] text-faint">Nothing to read.</p>}
      <div className="mt-6 space-y-12">
        {items.map((item) => (
          <CaptureCard key={item.key} uid={uid} item={item} />
        ))}
      </div>
    </main>
  );
}

function update(key: string, patch: Partial<CaptureItem>) {
  captureStore.set(captureStore.get().map((i) => (i.key === key ? { ...i, ...patch } : i)));
}

function remove(item: CaptureItem) {
  captureStore.set(captureStore.get().filter((i) => i.key !== item.key));
  if (item.snapId) void deleteSnap(item.snapId);
}

function CaptureCard({ uid, item }: { uid: string; item: CaptureItem }) {
  const router = useRouter();
  const { books, dupIndex } = useLibrary();
  const book = item.bookId ? books.get(item.bookId) : undefined;
  const [url] = useState(() => URL.createObjectURL(item.blob));
  const [state, setState] = useState<PageState[] | null>(null);
  const [picker, setPicker] = useState<number | null>(null);

  useEffect(() => () => URL.revokeObjectURL(url), [url]);

  // First result → editable state (once per read).
  const pagesKey = item.status === 'done' ? item.pages : null;
  const initial = useMemo(() => {
    if (!pagesKey) return null;
    const isDup = (text: string) => findSimilar(text, dupIndex) !== null;
    return pagesKey.map((p) => {
      const picks = initialPicks(p.passages, isDup);
      return {
        page: p.page ? String(p.page) : '',
        sectionId: guessSection(p.runningHead, book?.sections ?? [], item.sectionId),
        rows: p.passages.map((x, i) => ({ text: x.text, dup: isDup(x.text), picked: picks[i] })),
      };
    });
    // dupIndex changes on every save; the first read is the one to show.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagesKey]);
  const pages = state ?? initial;

  const setPage = (i: number, patch: Partial<PageState>) => setState((pages ?? []).map((p, j) => (j === i ? { ...p, ...patch } : p)));
  const setRow = (i: number, r: number, patch: Partial<Row>) =>
    setPage(i, { rows: (pages ?? [])[i].rows.map((x, k) => (k === r ? { ...x, ...patch } : x)) });

  const count = (pages ?? []).reduce((n, p) => n + p.rows.filter((r) => r.picked && r.text.trim()).length, 0);

  const save = () => {
    if (!pages) return;
    const inputs: QuoteInput[] = [];
    let maxPage = 0;
    for (const p of pages) {
      const page = Number(p.page) > 0 ? Math.min(20000, Math.floor(Number(p.page))) : null;
      if (page) maxPage = Math.max(maxPage, page);
      for (const r of p.rows) {
        const text = tidy(r.text);
        if (r.picked && text) inputs.push({ bookId: item.bookId, sectionId: book ? p.sectionId : null, kind: 'quote', text, note: '', page, source: 'ocr' });
      }
    }
    if (inputs.length) createQuotes(uid, inputs);
    if (book && maxPage && (!book.currentPage || maxPage > book.currentPage)) updateBook(uid, book.id, { currentPage: maxPage });
    remove(item);
    if (captureStore.get().length === 0) router.replace(item.bookId ? `/book/?id=${item.bookId}` : '/inbox/');
  };

  return (
    <section className="fade-in">
      <div className="flex items-start gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
        <img src={url} alt="" className="h-20 w-16 shrink-0 rounded-sm border border-line object-cover" />
        <div className="min-w-0 flex-1 text-[13px] text-faint">
          <p className="truncate text-ink">{book?.title ?? 'Inbox'}</p>
          {item.status === 'reading' && <p className="mt-1">Reading…</p>}
          {item.status === 'error' && (
            <p className="mt-1 flex flex-wrap gap-x-3 text-muted">
              Could not read this photo.
              <button type="button" onClick={() => update(item.key, { status: 'reading' })} className="text-ink">
                retry
              </button>
              {!item.snapId && (
                <button
                  type="button"
                  onClick={async () => {
                    await addSnap({ uid, bookId: item.bookId, sectionId: item.sectionId, blob: item.blob });
                    remove(item);
                  }}
                  className="text-faint hover:text-ink"
                >
                  keep for later
                </button>
              )}
            </p>
          )}
        </div>
      </div>

      {item.status === 'done' && pages && (
        <div className="mt-4 space-y-6">
          {pages.map((p, i) => (
            <div key={i}>
              <div className="flex items-baseline gap-4 text-[13px] text-faint">
                {book && (
                  <button type="button" onClick={() => setPicker(i)} className="min-w-0 truncate text-left hover:text-ink">
                    {pathOf(book.sections, p.sectionId).map((s) => s.title).join(' › ') || 'no chapter'}
                  </button>
                )}
                <label className="ml-auto flex shrink-0 items-baseline gap-1">
                  <span>p.</span>
                  <input
                    value={p.page}
                    inputMode="numeric"
                    onChange={(e) => setPage(i, { page: e.target.value.replace(/\D/g, '').slice(0, 5) })}
                    aria-label="Page"
                    className="w-[4.5ch] bg-transparent text-[16px] text-ink tabular-nums outline-none"
                  />
                </label>
              </div>
              {p.rows.length === 0 && <p className="mt-3 text-[14px] text-faint">No marked passages.</p>}
              <ul className="mt-2 space-y-3">
                {p.rows.map((r, k) => (
                  <li key={k} className={`flex items-start gap-3 ${r.picked ? '' : 'opacity-50'}`}>
                    <input
                      type="checkbox"
                      checked={r.picked}
                      onChange={(e) => setRow(i, k, { picked: e.target.checked })}
                      aria-label="Keep this passage"
                      className="mt-2 size-4 shrink-0 accent-[var(--ink)]"
                    />
                    <div className="min-w-0 flex-1">
                      <GrowText value={r.text} onChange={(v) => setRow(i, k, { text: v })} label="Passage" wrapClassName="quote-text" />
                      {r.dup && <p className="text-[12px] text-faint">already saved</p>}
                    </div>
                  </li>
                ))}
              </ul>
              {book && picker === i && (
                <SectionPicker
                  open
                  onClose={() => setPicker(null)}
                  sections={book.sections}
                  current={p.sectionId}
                  onPick={(id) => setPage(i, { sectionId: id })}
                  onAdd={(next) => updateBook(uid, book.id, { sections: next })}
                />
              )}
            </div>
          ))}
          <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2 text-[14px]">
            <button type="button" onClick={save} disabled={count === 0} className="text-ink disabled:text-faint">
              save {count} {count === 1 ? 'quote' : 'quotes'}
            </button>
            {item.mode === 'marked' && (
              <button
                type="button"
                onClick={() => {
                  setState(null);
                  update(item.key, { mode: 'all', status: 'reading', pages: [] });
                }}
                className="text-faint hover:text-ink"
              >
                read whole page
              </button>
            )}
            <button type="button" onClick={() => remove(item)} className="text-faint hover:text-ink">
              discard
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
