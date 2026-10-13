'use client';

// ============================================================
// legi - Read slowly: one quote per screen, like a pocket book
//
// → Space, tap right half, swipe left: next · ← tap left half, swipe right:
// previous · Esc: back to the book at this quote. `all · starred` top right.
// ============================================================

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import Typewriter from '@/components/Typewriter';
import QuoteText from '@/components/QuoteText';
import { useLibrary } from '@/contexts/LibraryContext';
import { buildTree, flatten, pathOf } from '@/lib/outline';
import type { QuoteRow } from '@/types/legi';

const OUT_MS = 120;

export default function SlowView() {
  const params = useSearchParams();
  const router = useRouter();
  const { books, byBook, loaded } = useLibrary();
  const id = params.get('id') ?? '';
  const book = books.get(id);
  const [starred, setStarred] = useState(false);
  const [index, setIndex] = useState<number | null>(null);
  const [leaving, setLeaving] = useState(false);
  const touch = useRef<{ x: number; y: number } | null>(null);

  // Same order as the book page: top quotes, then sections depth-first.
  const list = useMemo(() => {
    if (!book) return [];
    const all = (byBook.get(book.id) ?? []).filter((q) => q.kind === 'quote' || q.kind === 'thought');
    const known = new Set(book.sections.map((s) => s.id));
    const out: QuoteRow[] = all.filter((q) => !q.sectionId || !known.has(q.sectionId));
    for (const n of flatten(buildTree(book.sections))) out.push(...all.filter((q) => q.sectionId === n.section.id));
    return starred ? out.filter((q) => q.favorite) : out;
  }, [book, byBook, starred]);

  const from = params.get('from');
  const start = from ? Math.max(0, list.findIndex((q) => q.id === from)) : 0;
  const i = Math.min(index ?? start, Math.max(0, list.length - 1));
  const quote = list[i];

  const go = useCallback(
    (dir: 1 | -1) => {
      const next = i + dir;
      if (next < 0 || next >= list.length) return;
      setLeaving(true);
      setTimeout(() => {
        setIndex(next);
        setLeaving(false);
      }, OUT_MS);
    },
    [i, list.length],
  );

  const exit = useCallback(() => {
    router.replace(quote ? `/book/?id=${id}&q=${quote.id}` : `/book/?id=${id}`);
  }, [router, id, quote]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        go(1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        go(-1);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        exit();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, exit]);

  if (!loaded) return <main className="min-h-dvh" />;
  if (!book) {
    return (
      <main className="paper">
        <p className="mt-16 text-faint">This book is not here.</p>
      </main>
    );
  }

  const where = quote ? pathOf(book.sections, quote.sectionId).map((s) => s.title).join(' › ') : '';

  return (
    <main
      className="fixed inset-0 flex flex-col bg-bg select-none"
      onTouchStart={(e) => (touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })}
      onTouchEnd={(e) => {
        const t = touch.current;
        touch.current = null;
        if (!t) return;
        const dx = e.changedTouches[0].clientX - t.x;
        const dy = e.changedTouches[0].clientY - t.y;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
      }}
    >
      <div className="mx-auto flex w-full max-w-[36rem] items-baseline gap-4 px-5 pt-[calc(env(safe-area-inset-top)+16px)] text-[13px] text-faint">
        <button type="button" onClick={exit} className="hover:text-ink">
          {book.title}
        </button>
        <span className="min-w-0 flex-1 truncate">{where}</span>
        <div className="flex gap-3" role="radiogroup" aria-label="Which quotes">
          <button type="button" role="radio" aria-checked={!starred} onClick={() => (setStarred(false), setIndex(0))} className={!starred ? 'text-ink' : 'hover:text-muted'}>
            all
          </button>
          <button type="button" role="radio" aria-checked={starred} onClick={() => (setStarred(true), setIndex(0))} className={starred ? 'text-ink' : 'hover:text-muted'}>
            starred
          </button>
        </div>
      </div>

      <div className="relative flex flex-1 items-center justify-center px-6">
        <button type="button" aria-label="Previous" tabIndex={-1} onClick={() => go(-1)} className="absolute inset-y-0 left-0 w-1/2 cursor-w-resize" />
        <button type="button" aria-label="Next" tabIndex={-1} onClick={() => go(1)} className="absolute inset-y-0 right-0 w-1/2 cursor-e-resize" />
        {quote ? (
          <div
            key={quote.id}
            className={`pointer-events-none relative max-w-[32rem] transition-opacity ${leaving ? 'opacity-0 duration-[120ms]' : 'fade-in duration-[180ms]'}`}
          >
            <p className={`${quote.kind === 'quote' ? 'text-ink' : 'text-muted'} text-[calc(var(--quote-size)+3px)] leading-[1.75] whitespace-pre-wrap`}>
              {quote.kind === 'quote' ? <Typewriter text={quote.text} /> : <QuoteText text={quote.text} />}
            </p>
            {quote.note && <p className="mt-4 pl-4 text-[15px] leading-relaxed whitespace-pre-wrap text-muted">{quote.note}</p>}
          </div>
        ) : (
          <p className="text-faint">{starred ? 'No starred quotes.' : 'No quotes yet.'}</p>
        )}
      </div>

      <div className="mx-auto flex w-full max-w-[36rem] justify-between px-5 pb-[calc(env(safe-area-inset-bottom)+16px)] text-[13px] text-faint tabular-nums">
        <span>{quote?.page != null ? `p. ${quote.page}` : ''}</span>
        <span>{list.length ? `${i + 1} / ${list.length}` : ''}</span>
      </div>
      <Link href={`/book/?id=${id}`} className="sr-only">
        Back to book
      </Link>
    </main>
  );
}
