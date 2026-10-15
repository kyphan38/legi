'use client';

// ============================================================
// legi - One book: header, quotes by section, composer at the bottom
//
// /book/?id=…           open the book (scroll back to where you were)
// /book/?id=…&new=1     scroll to the end, cursor in the composer
// /book/?id=…&q=…       scroll to one quote and outline it once
// ============================================================

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useUid } from '@/components/AuthGate';
import BookHeader from '@/components/BookHeader';
import Composer, { type ComposerHandle } from '@/components/Composer';
import { OutlineBar, OutlineRail } from '@/components/Outline';
import TopBar from '@/components/TopBar';
import { useLibrary } from '@/contexts/LibraryContext';
import { inField, scrollToQuote, useQuoteBoard } from '@/hooks/useQuoteBoard';
import { buildTree, flatten, misplacedByPage, pathOf, subtreeIds, type TreeNode } from '@/lib/outline';
import { moveQuotes, placeQuotes, updateBook } from '@/lib/repo';
import { readJson, writeJson } from '@/lib/store';
import type { BookRow, QuoteRow, Section } from '@/types/legi';

const OPENED_WRITE_MS = 10 * 60 * 1000;
export const LAST_BOOK_KEY = 'legi.last';

export default function BookView() {
  const params = useSearchParams();
  const id = params.get('id');
  const { books, loaded } = useLibrary();
  const book = id ? books.get(id) : undefined;

  if (!book) {
    if (!loaded) return <main className="paper" />;
    return (
      <main className="paper">
        <TopBar current={null} />
        <p className="mt-16 text-faint">This book is not here.</p>
      </main>
    );
  }
  if (book.deletedAt !== null) {
    return (
      <main className="paper">
        <TopBar current={null} />
        <p className="mt-16 text-faint">
          This book is in{' '}
          <Link href="/trash/" className="text-ink">
            trash
          </Link>
          .
        </p>
      </main>
    );
  }
  return <BookPage key={book.id} book={book} focusQuote={params.get('q')} startNew={params.get('new') === '1'} />;
}

/** "shelf · contents" (contents only below the width where the rail shows). */
function BookLeft({ onContents }: { onContents: (() => void) | null }) {
  return (
    <span className="flex items-baseline">
      <Link href="/shelf/" className="py-2 hover:text-ink">
        shelf
      </Link>
      {onContents && (
        <span className="xl:hidden">
          <span className="px-1.5">·</span>
          <button type="button" onClick={onContents} className="py-2 hover:text-ink">
            contents
          </button>
        </span>
      )}
    </span>
  );
}

function BookPage({ book, focusQuote, startNew }: { book: BookRow; focusQuote: string | null; startNew: boolean }) {
  const uid = useUid();
  const router = useRouter();
  const { byBook, loaded } = useLibrary();
  const quotes = useMemo(() => byBook.get(book.id) ?? [], [byBook, book.id]);
  const composer = useRef<ComposerHandle>(null);
  const [folded, setFolded] = useState<Set<string>>(() => new Set(readJson<string[]>(`legi.fold.${book.id}`) ?? []));
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pad, setPad] = useState(160);
  const [contents, setContents] = useState(false);
  const restored = useRef(false);

  const tree = useMemo(() => buildTree(book.sections), [book.sections]);
  const nodes = useMemo(() => flatten(tree), [tree]);
  const known = useMemo(() => new Set(book.sections.map((s) => s.id)), [book.sections]);

  const bySection = useMemo(() => {
    const m = new Map<string, QuoteRow[]>();
    for (const q of quotes) {
      const key = q.sectionId && known.has(q.sectionId) ? q.sectionId : '';
      const list = m.get(key);
      if (list) list.push(q);
      else m.set(key, [q]);
    }
    return m;
  }, [quotes, known]);

  // Quotes saved before the sections had first pages, now in the wrong place.
  const misplaced = useMemo(() => misplacedByPage(book.sections, quotes), [book.sections, quotes]);

  // Count per section includes everything below it.
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const n of nodes) {
      let c = 0;
      for (const sid of subtreeIds(book.sections, n.section.id)) c += bySection.get(sid)?.length ?? 0;
      m.set(n.section.id, c);
    }
    return m;
  }, [nodes, book.sections, bySection]);

  const hidden = useMemo(() => {
    const out = new Set<string>();
    for (const id of folded) {
      if (!known.has(id)) continue;
      for (const sid of subtreeIds(book.sections, id)) if (sid !== id) out.add(sid);
    }
    return out;
  }, [folded, known, book.sections]);

  const visibleNodes = nodes.filter((n) => !hidden.has(n.section.id));
  const ordered = useMemo(() => {
    const out = [...(bySection.get('') ?? [])];
    for (const n of nodes) {
      if (hidden.has(n.section.id) || folded.has(n.section.id)) continue;
      out.push(...(bySection.get(n.section.id) ?? []));
    }
    return out;
  }, [bySection, nodes, hidden, folded]);

  const board = useQuoteBoard(uid, ordered, { bookId: book.id });

  const setFold = useCallback(
    (next: Set<string>) => {
      setFolded(next);
      writeJson(`legi.fold.${book.id}`, [...next]);
    },
    [book.id],
  );
  const toggleFold = (id: string) => {
    const next = new Set(folded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setFold(next);
  };
  const foldAll = useCallback((fold: boolean) => setFold(fold ? new Set(book.sections.map((s) => s.id)) : new Set()), [setFold, book.sections]);

  // Remember this book; note the open time at most every 10 minutes (one write).
  useEffect(() => {
    writeJson(LAST_BOOK_KEY, book.id);
    if (Date.now() - book.lastOpenedAt > OPENED_WRITE_MS) updateBook(uid, book.id, { lastOpenedAt: Date.now() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book.id]);

  // Space under the list for the composer.
  useEffect(() => {
    const el = document.querySelector('[data-composer]');
    if (!el) return;
    const ro = new ResizeObserver(() => setPad(el.getBoundingClientRect().height + 48));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Back to where you were, or to the quote asked for, or to the end.
  useEffect(() => {
    if (!loaded || restored.current) return;
    restored.current = true;
    requestAnimationFrame(() => {
      if (focusQuote) {
        const q = quotes.find((x) => x.id === focusQuote);
        if (q?.sectionId && (folded.has(q.sectionId) || hidden.has(q.sectionId))) foldAll(false);
        requestAnimationFrame(() => scrollToQuote(focusQuote, true));
        router.replace(`/book/?id=${book.id}`, { scroll: false });
      } else if (startNew) {
        window.scrollTo({ top: document.documentElement.scrollHeight });
        composer.current?.focus();
        router.replace(`/book/?id=${book.id}`, { scroll: false });
      } else {
        const y = readJson<number>(`legi.scroll.${book.id}`);
        if (y) window.scrollTo({ top: y });
      }
    });
  }, [loaded, focusQuote, startNew, quotes, folded, hidden, foldAll, router, book.id]);

  // Save the scroll position and find the section being read.
  useEffect(() => {
    let raf = 0;
    let saveTimer: ReturnType<typeof setTimeout> | null = null;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const heads = document.querySelectorAll<HTMLElement>('[data-section]');
        let current: string | null = null;
        for (const h of heads) {
          if (h.getBoundingClientRect().top < 140) current = h.dataset.section ?? null;
          else break;
        }
        setActiveId(current);
      });
      if (!saveTimer) {
        saveTimer = setTimeout(() => {
          saveTimer = null;
          writeJson(`legi.scroll.${book.id}`, Math.round(window.scrollY));
        }, 500);
      }
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      if (saveTimer) clearTimeout(saveTimer);
      window.removeEventListener('scroll', onScroll);
    };
  }, [book.id, nodes]);

  // n → composer, [ / ] → fold / unfold all.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || inField(e.target)) return;
      if (document.querySelector('[role="dialog"]')) return;
      if (e.key === 'n') {
        e.preventDefault();
        composer.current?.focus();
      } else if (e.key === '[') foldAll(true);
      else if (e.key === ']') foldAll(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [foldAll]);

  const jump = (id: string) => {
    if (hidden.has(id)) {
      const next = new Set(folded);
      pathOf(book.sections, id).forEach((s) => next.delete(s.id));
      setFold(next);
    }
    requestAnimationFrame(() => {
      const el = document.getElementById(`s-${id}`);
      if (!el) return;
      const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
      // Clear the sticky TopBar and the path line under it.
      const bar = document.querySelector('[data-topbar]')?.getBoundingClientRect().bottom ?? 0;
      window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - bar - 44, behavior: reduce ? 'auto' : 'smooth' });
    });
  };

  const outline = {
    nodes,
    sections: book.sections,
    counts,
    activeId,
    onJump: jump,
    onChange: (sections: Section[]) => updateBook(uid, book.id, { sections }),
    onRemove: (id: string, parentId: string | null) => {
      const rows = bySection.get(id) ?? [];
      if (rows.length) moveQuotes(uid, rows, book.id, parentId);
    },
    onFoldAll: foldAll,
    misplaced: misplaced.length,
    onPlaceByPage: () => placeQuotes(uid, misplaced),
  };
  const activePath = pathOf(book.sections, activeId)
    .map((s) => s.title)
    .join(' › ');

  let rise = 0;
  const renderNode = (n: TreeNode) => {
    const isFolded = folded.has(n.section.id);
    const list = isFolded ? [] : (bySection.get(n.section.id) ?? []);
    const head =
      n.depth === 0
        ? 'mt-14 text-[15px] font-medium text-ink'
        : n.depth === 1
          ? 'mt-9 text-[14px] text-muted'
          : 'mt-7 text-[13px] text-faint';
    return (
      <section key={n.section.id}>
        <h2 id={`s-${n.section.id}`} data-section={n.section.id} className={head} style={{ paddingLeft: Math.max(0, n.depth - 1) * 12 }}>
          <button type="button" onClick={() => toggleFold(n.section.id)} aria-expanded={!isFolded} className="flex w-full items-baseline justify-between gap-3 text-left">
            <span className="min-w-0">{n.section.title}</span>
            {isFolded && <span className="shrink-0 text-[12px] font-normal text-faint tabular-nums">{counts.get(n.section.id) || ''}</span>}
          </button>
        </h2>
        {list.length > 0 && <div className="mt-4 space-y-5">{list.map((q) => board.renderItem(q, rise++))}</div>}
      </section>
    );
  };

  const top = bySection.get('') ?? [];

  return (
    <>
      <OutlineRail {...outline} />
      <main className="paper" style={{ paddingBottom: pad }}>
        <TopBar current={null} left={<BookLeft onContents={book.sections.length ? () => setContents(true) : null} />} />
        <OutlineBar {...outline} path={activePath} open={contents} onOpenChange={setContents} />
        <BookHeader uid={uid} book={book} onDeleted={() => router.replace('/shelf/')} />
        {top.length > 0 && <div className="mt-10 space-y-5">{top.map((q) => board.renderItem(q, rise++))}</div>}
        {visibleNodes.map(renderNode)}
      </main>
      <Composer
        ref={composer}
        uid={uid}
        book={book}
        onSaved={(ids) => {
          const last = ids.at(-1);
          if (last) setTimeout(() => scrollToQuote(last), 60);
        }}
      />
      {board.overlays}
    </>
  );
}
