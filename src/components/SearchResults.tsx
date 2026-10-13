'use client';

import Link from 'next/link';

import QuoteText from '@/components/QuoteText';
import { useLibrary } from '@/contexts/LibraryContext';
import type { SearchResult } from '@/lib/search';
import type { QuoteRow } from '@/types/legi';

export function hrefOf(q: QuoteRow): string {
  return q.bookId ? `/book/?id=${q.bookId}&q=${q.id}` : `/inbox/?q=${q.id}`;
}

export default function SearchResults({ result, onPick }: { result: SearchResult; onPick?: () => void }) {
  const { books } = useLibrary();
  const empty = result.groups.length === 0 && result.books.length === 0 && result.sections.length === 0;
  if (empty) return <p className="mt-6 text-[14px] text-faint">No results.</p>;
  return (
    <div className="mt-4 space-y-8">
      {(result.books.length > 0 || result.sections.length > 0) && (
        <ul className="space-y-1 text-[15px]">
          {result.books.map((b) => (
            <li key={b.id}>
              <Link href={`/book/?id=${b.id}`} onClick={onPick} className="block py-1 text-ink">
                {b.title}
                {b.author && <span className="text-faint"> · {b.author}</span>}
              </Link>
            </li>
          ))}
          {result.sections.map((s) => (
            <li key={`${s.book.id}-${s.id}`}>
              <Link href={`/book/?id=${s.book.id}`} onClick={onPick} className="block py-1 text-muted">
                {s.title}
                <span className="text-faint"> · {s.book.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {result.groups.map((g) => (
        <section key={g.bookId ?? 'inbox'}>
          <h2 className="text-[13px] text-faint">{g.bookId ? books.get(g.bookId)?.title : 'Inbox'}</h2>
          <ul className="mt-2 space-y-4">
            {g.hits.map((h) => (
              <li key={h.quote.id}>
                <Link href={hrefOf(h.quote)} onClick={onPick} className={`block ${h.quote.kind === 'quote' ? 'quote-text' : 'thought-text'} text-ink`}>
                  <QuoteText text={h.quote.text.replace(/\*\*/g, '')} marks={h.marks} />
                  {h.quote.page !== null && <span className="ml-2 font-sans text-[12px] text-faint tabular-nums">{h.quote.page}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
