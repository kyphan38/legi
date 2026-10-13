'use client';

import { useDeferredValue, useMemo, useState } from 'react';

import SearchResults from '@/components/SearchResults';
import TopBar from '@/components/TopBar';
import { useLibrary } from '@/contexts/LibraryContext';
import { searchAll } from '@/lib/search';

/** Search on phones. Desktop uses ⌘K (CommandPalette) with the same results. */
export default function SearchView() {
  const { liveBooks, liveQuotes } = useLibrary();
  const [query, setQuery] = useState('');
  const deferred = useDeferredValue(query);
  const result = useMemo(() => searchAll(deferred, liveBooks, liveQuotes), [deferred, liveBooks, liveQuotes]);

  return (
    <main className="paper pb-24">
      <TopBar current="search" />
      <input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        type="search"
        placeholder="Search"
        aria-label="Search"
        lang="vi"
        spellCheck={false}
        className="mt-8 w-full border-b border-line-strong bg-transparent py-2 text-[18px] text-ink outline-none placeholder:text-faint"
      />
      {deferred.trim() && <SearchResults result={result} />}
    </main>
  );
}
