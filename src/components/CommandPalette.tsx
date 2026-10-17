'use client';

// ⌘K / Ctrl+K: search and commands in one place, no extra buttons.
// Empty → commands. Typing → matching commands, books, then quotes.

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useDeferredValue, useEffect, useMemo, useState, useSyncExternalStore } from 'react';

import { hrefOf } from '@/components/SearchResults';
import QuoteText from '@/components/QuoteText';
import { useLibrary } from '@/contexts/LibraryContext';
import { applyDisplayPrefs, sizeStore, themeStore, type TextSize, type Theme } from '@/lib/prefs';
import { searchAll } from '@/lib/search';
import { exportAll } from '@/lib/share-file';
import { fold } from '@/lib/vi';

type Item = { key: string; label: React.ReactNode; hint?: string; text: string; run: () => void; quote?: boolean };

export const paletteStore = (() => {
  let open = false;
  const listeners = new Set<() => void>();
  return {
    subscribe(fn: () => void) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    get: () => open,
    getServer: () => false,
    set(v: boolean) {
      open = v;
      listeners.forEach((fn) => fn());
    },
  };
})();

export default function CommandPalette() {
  const open = useSyncExternalStore(paletteStore.subscribe, paletteStore.get, paletteStore.getServer);
  if (!open) return null;
  return <Palette onClose={() => paletteStore.set(false)} />;
}

function Palette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { liveBooks, liveQuotes, books, quotes } = useLibrary();
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const deferred = useDeferredValue(query);

  const items = useMemo<Item[]>(() => {
    const go = (href: string) => () => router.push(href);
    const theme = (t: Theme) => () => {
      themeStore.set(t);
      applyDisplayPrefs(t, sizeStore.get());
    };
    const size = (s: TextSize) => () => {
      sizeStore.set(s);
      applyDisplayPrefs(themeStore.get(), s);
    };
    const bookId = pathname.startsWith('/book') ? params.get('id') : null;
    const commands: Item[] = [
      { key: 'new', label: 'new book', text: 'new book', run: go('/shelf/?add=1') },
      { key: 'daily', label: 'daily', text: 'daily', run: go('/?daily=1') },
      { key: 'shelf', label: 'shelf', text: 'shelf', run: go('/shelf/') },
      { key: 'inbox', label: 'inbox', text: 'inbox', run: go('/inbox/') },
      { key: 'questions', label: 'questions', text: 'questions', run: go('/questions/') },
      { key: 'trash', label: 'trash', text: 'trash', run: go('/trash/') },
      { key: 'settings', label: 'settings', text: 'settings', run: go('/settings/') },
      ...(bookId ? [{ key: 'slow', label: 'read slowly', text: 'read slowly', run: go(`/slow/?id=${bookId}`) }] : []),
      ...(['system', 'light', 'dark'] as Theme[]).map((t) => ({ key: `t-${t}`, label: `theme: ${t}`, text: `theme ${t}`, run: theme(t) })),
      ...(['s', 'm', 'l'] as TextSize[]).map((s) => ({ key: `s-${s}`, label: `size: ${s.toUpperCase()}`, text: `size ${s}`, run: size(s) })),
      { key: 'md', label: 'export markdown', text: 'export markdown', run: () => void exportAll('md', [...books.values()], [...quotes.values()]) },
      { key: 'json', label: 'export json', text: 'export json', run: () => void exportAll('json', [...books.values()], [...quotes.values()]) },
    ];
    const q = fold(deferred);
    if (!q) return commands;
    const words = q.split(' ');
    const match = (s: string) => words.every((w) => fold(s).includes(w));
    const result = searchAll(deferred, liveBooks, liveQuotes);
    const bookItems: Item[] = result.books.map((b) => ({ key: `b-${b.id}`, label: b.title, hint: 'book', text: b.title, run: go(`/book/?id=${b.id}`) }));
    const quoteItems: Item[] = result.groups.flatMap((g) =>
      g.hits.slice(0, 8).map((h) => ({
        key: `q-${h.quote.id}`,
        label: <QuoteText text={h.quote.text.replace(/\*\*/g, '')} marks={h.marks} />,
        hint: g.bookId ? books.get(g.bookId)?.title : 'Inbox',
        text: h.quote.text,
        quote: true,
        run: go(hrefOf(h.quote)),
      })),
    );
    return [...commands.filter((c) => match(c.text)), ...bookItems, ...quoteItems].slice(0, 40);
  }, [deferred, router, pathname, params, liveBooks, liveQuotes, books, quotes]);

  const active = Math.min(index, Math.max(0, items.length - 1));

  useEffect(() => {
    document.getElementById(`pal-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const run = (it: Item | undefined) => {
    if (!it) return;
    onClose();
    it.run();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12dvh]" role="dialog" aria-modal="true" aria-label="Command palette">
      <button type="button" aria-label="Close" onClick={onClose} className="fade-in absolute inset-0 bg-black/25" />
      <div className="sheet-up relative w-full max-w-[36rem] overflow-hidden rounded-2xl border border-line bg-surface">
        <input
          autoFocus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIndex(0);
          }}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing) return;
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setIndex((i) => Math.min(items.length - 1, i + 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setIndex((i) => Math.max(0, i - 1));
            } else if (e.key === 'Enter') {
              e.preventDefault();
              run(items[active]);
            } else if (e.key === 'Escape') {
              e.preventDefault();
              onClose();
            }
          }}
          placeholder="Search or run a command"
          aria-label="Search or run a command"
          lang="vi"
          spellCheck={false}
          className="w-full border-b border-line bg-transparent px-5 py-4 text-[17px] text-ink outline-none placeholder:text-faint"
        />
        <ul className="max-h-[55dvh] overflow-y-auto py-2">
          {items.map((it, i) => (
            <li key={it.key} id={`pal-${i}`}>
              <button
                type="button"
                onMouseMove={() => setIndex(i)}
                onClick={() => run(it)}
                className={`flex w-full items-baseline gap-3 px-5 py-2 text-left ${i === active ? 'bg-wash' : ''}`}
              >
                <span className={`min-w-0 flex-1 ${it.quote ? 'line-clamp-2 text-[15px] leading-relaxed text-ink' : 'truncate text-[15px] text-ink'}`}>{it.label}</span>
                {it.hint && <span className="max-w-[40%] shrink-0 truncate text-[12px] text-faint">{it.hint}</span>}
              </button>
            </li>
          ))}
          {items.length === 0 && <li className="px-5 py-2 text-[14px] text-faint">No results.</li>}
        </ul>
      </div>
    </div>
  );
}
