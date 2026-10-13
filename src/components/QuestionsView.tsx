'use client';

import { useMemo } from 'react';

import { useUid } from '@/components/AuthGate';
import TopBar from '@/components/TopBar';
import { useLibrary } from '@/contexts/LibraryContext';
import { useQuoteBoard } from '@/hooks/useQuoteBoard';
import { viCollator } from '@/lib/vi';
import type { QuoteRow } from '@/types/legi';

/** Open questions (no answer yet), by book. */
export default function QuestionsView() {
  const uid = useUid();
  const { liveQuotes, books, loaded } = useLibrary();

  const groups = useMemo(() => {
    const m = new Map<string, QuoteRow[]>();
    for (const q of liveQuotes) {
      if (q.kind !== 'question' || q.answeredBy !== null) continue;
      const k = q.bookId ?? '';
      m.set(k, [...(m.get(k) ?? []), q]);
    }
    return [...m.entries()].sort((a, b) => viCollator.compare(books.get(a[0])?.title ?? '~', books.get(b[0])?.title ?? '~'));
  }, [liveQuotes, books]);

  const ordered = useMemo(() => groups.flatMap(([, qs]) => qs), [groups]);
  const board = useQuoteBoard(uid, ordered, { bookId: null });

  return (
    <main className="paper pb-24">
      <TopBar current={null} />
      <h1 className="mt-8 text-[15px] font-medium text-ink">Questions</h1>
      {loaded && ordered.length === 0 && <p className="mt-6 text-[14px] text-faint">No open questions.</p>}
      {groups.map(([bookId, qs]) => (
        <section key={bookId || 'inbox'} className="mt-8">
          <h2 className="text-[13px] text-faint">{books.get(bookId)?.title ?? 'Inbox'}</h2>
          <div className="mt-3 space-y-5">{qs.map((q, i) => board.renderItem(q, i))}</div>
        </section>
      ))}
      {board.overlays}
    </main>
  );
}
