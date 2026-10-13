'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

import { useUid } from '@/components/AuthGate';
import Composer, { type ComposerHandle } from '@/components/Composer';
import TopBar from '@/components/TopBar';
import { useLibrary } from '@/contexts/LibraryContext';
import { scrollToQuote, useQuoteBoard } from '@/hooks/useQuoteBoard';

/** Quotes with no book yet. Long press → select → move them into a book. */
export default function InboxView() {
  const uid = useUid();
  const params = useSearchParams();
  const { byBook, loaded } = useLibrary();
  const quotes = useMemo(() => byBook.get('') ?? [], [byBook]);
  const board = useQuoteBoard(uid, quotes, { bookId: null });
  const composer = useRef<ComposerHandle>(null);
  const [pad, setPad] = useState(160);
  const focus = params.get('q');

  useEffect(() => {
    const el = document.querySelector('[data-composer]');
    if (!el) return;
    const ro = new ResizeObserver(() => setPad(el.getBoundingClientRect().height + 48));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (loaded && focus) requestAnimationFrame(() => scrollToQuote(focus, true));
  }, [loaded, focus]);

  return (
    <>
      <main className="paper" style={{ paddingBottom: pad }}>
        <TopBar current={null} />
        <h1 className="mt-8 text-[15px] font-medium text-ink">Inbox</h1>
        <div className="mt-6 space-y-5">{quotes.map((q, i) => board.renderItem(q, i))}</div>
      </main>
      <Composer ref={composer} uid={uid} book={null} onSaved={(ids) => ids.at(-1) && setTimeout(() => scrollToQuote(ids.at(-1) as string), 60)} />
      {board.overlays}
    </>
  );
}
