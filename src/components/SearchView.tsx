'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useDeferredValue, useMemo, useState } from 'react';

import QuoteText from '@/components/QuoteText';
import SearchResults, { hrefOf } from '@/components/SearchResults';
import TopBar from '@/components/TopBar';
import { useLibrary } from '@/contexts/LibraryContext';
import { searchMeaning, type MeaningHit } from '@/lib/ai';
import { searchAll } from '@/lib/search';

type Mode = 'words' | 'meaning';

/**
 * Search on phones. Desktop uses ⌘K (CommandPalette) with the same word results.
 * "meaning" asks the server (a vector per quote) and runs on Enter, not on every key.
 */
export default function SearchView() {
  const params = useSearchParams();
  const { liveBooks, liveQuotes, quotes, books } = useLibrary();
  const [mode, setMode] = useState<Mode>(params.get('m') === '1' ? 'meaning' : 'words');
  const [query, setQuery] = useState('');
  const deferred = useDeferredValue(query);
  const result = useMemo(() => searchAll(deferred, liveBooks, liveQuotes), [deferred, liveBooks, liveQuotes]);

  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'failed'>('idle');
  const [failText, setFailText] = useState('');
  const [hits, setHits] = useState<MeaningHit[]>([]);
  const [partial, setPartial] = useState(false);
  const [asked, setAsked] = useState('');

  const runMeaning = async () => {
    const q = query.trim();
    if (!q || state === 'busy') return;
    setState('busy');
    setAsked(q);
    try {
      const res = await searchMeaning(q);
      setHits(res.hits);
      setPartial(res.partial);
      setState('done');
    } catch (err) {
      setFailText((err as { code?: string }).code === 'functions/resource-exhausted' ? 'AI credit used up.' : 'Could not search. Try again.');
      setState('failed');
    }
  };

  // Hits for quotes still in the library (a vector can outlive a deleted quote for a moment).
  const found = hits.flatMap((h) => {
    const q = quotes.get(h.id);
    return q && q.deletedAt === null ? [q] : [];
  });

  return (
    <main className="paper pb-24">
      <TopBar current="search" />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (mode === 'meaning') void runMeaning();
        }}
      >
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          type="search"
          enterKeyHint="search"
          placeholder={mode === 'meaning' ? 'An idea, then Enter' : 'Search'}
          aria-label="Search"
          lang="vi"
          spellCheck={false}
          className="mt-8 w-full border-b border-line-strong bg-transparent py-2 text-[18px] text-ink outline-none placeholder:text-faint"
        />
      </form>
      <div className="mt-3 flex gap-3 text-[13px]" role="radiogroup" aria-label="Search by">
        {(['words', 'meaning'] as const).map((m) => (
          <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => setMode(m)} className={mode === m ? 'text-ink' : 'text-faint hover:text-muted'}>
            {m}
          </button>
        ))}
      </div>

      {mode === 'words' && deferred.trim() && <SearchResults result={result} />}

      {mode === 'meaning' && (
        <>
          {state === 'busy' && <p className="breathe mt-6 text-[14px] text-faint">searching…</p>}
          {state === 'failed' && <p className="mt-6 text-[14px] text-muted">{failText}</p>}
          {state === 'done' && asked === query.trim() && (
            <>
              {partial && <p className="mt-6 text-[13px] text-faint">Still reading your quotes. Search again in a minute for more.</p>}
              {found.length === 0 ? (
                <p className="mt-6 text-[14px] text-faint">No close quotes.</p>
              ) : (
                <ul className="fade-in mt-6 space-y-5">
                  {found.map((q) => (
                    <li key={q.id}>
                      <Link href={hrefOf(q)} className={`block ${q.kind === 'quote' ? 'quote-text' : 'thought-text'} text-ink`}>
                        <QuoteText text={q.text.replace(/\*\*/g, '')} />
                      </Link>
                      <p className="mt-1 text-[12px] text-faint">{q.bookId ? books.get(q.bookId)?.title : 'Inbox'}</p>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </>
      )}
    </main>
  );
}
