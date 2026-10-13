'use client';

import Link from 'next/link';
import { useDeferredValue, useMemo, useState } from 'react';

import QuoteText from '@/components/QuoteText';
import Sheet from '@/components/Sheet';
import { useLibrary } from '@/contexts/LibraryContext';
import { updateQuote } from '@/lib/repo';
import { searchAll } from '@/lib/search';
import type { QuoteRow } from '@/types/legi';

/** Pick the quote that answers a question. Quotes of the same book come first. */
export default function AnswerPicker({ uid, question, open, onClose }: { uid: string; question: QuoteRow; open: boolean; onClose: () => void }) {
  const { liveBooks, liveQuotes, books } = useLibrary();
  const [query, setQuery] = useState('');
  const deferred = useDeferredValue(query);

  const options = useMemo(() => {
    const pool = liveQuotes.filter((q) => q.id !== question.id && q.kind !== 'question');
    const hits = deferred.trim() ? searchAll(deferred, liveBooks, pool).groups.flatMap((g) => g.hits.map((h) => h.quote)) : pool.filter((q) => q.bookId === question.bookId);
    return [...hits.filter((q) => q.bookId === question.bookId), ...hits.filter((q) => q.bookId !== question.bookId)].slice(0, 30);
  }, [deferred, liveBooks, liveQuotes, question.id, question.bookId]);

  const pick = (id: string | null) => {
    updateQuote(uid, question.id, { answeredBy: id });
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} label="Answered by">
      <input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search"
        aria-label="Search"
        lang="vi"
        spellCheck={false}
        className="w-full border-b border-line bg-transparent py-2 text-[16px] text-ink outline-none placeholder:text-faint"
      />
      <ul className="mt-3 space-y-3">
        {options.map((q) => (
          <li key={q.id}>
            <button type="button" onClick={() => pick(q.id)} className="block w-full text-left">
              <span className="line-clamp-3 text-[15px] leading-relaxed text-ink">
                <QuoteText text={q.text} />
              </span>
              <span className="text-[12px] text-faint">{q.bookId ? books.get(q.bookId)?.title : 'Inbox'}</span>
            </button>
          </li>
        ))}
      </ul>
      {question.answeredBy && (
        <button type="button" onClick={() => pick(null)} className="mt-4 text-[13px] text-faint hover:text-ink">
          not answered
        </button>
      )}
    </Sheet>
  );
}

/** Under an answered question: the answer, small. Tap → go to it. */
export function AnswerLine({ id }: { id: string }) {
  const { quotes } = useLibrary();
  const a = quotes.get(id);
  if (!a || a.deletedAt !== null) return null;
  return (
    <Link
      href={a.bookId ? `/book/?id=${a.bookId}&q=${a.id}` : `/inbox/?q=${a.id}`}
      onClick={(e) => e.stopPropagation()}
      className="mt-1 mr-11 block pl-4 text-[14px] leading-relaxed text-muted hover:text-ink"
    >
      <span className="text-[12px] text-faint">answer · </span>
      {a.text.replace(/\*\*/g, '')}
    </Link>
  );
}
