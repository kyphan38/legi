'use client';

import { useRouter } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

import CommandPalette, { paletteStore } from '@/components/CommandPalette';
import Sheet from '@/components/Sheet';
import { inField } from '@/hooks/useQuoteBoard';
import { undo } from '@/lib/undo';

const HELP: [string, string][] = [
  ['⌘K  /', 'search, commands'],
  ['n', 'new quote'],
  ['⌘↵', 'save'],
  ['↵ on an empty line', 'save'],
  ['⌘B', 'emphasis'],
  ['j  k', 'next, previous quote'],
  ['e  ↵', 'edit'],
  ['f', 'star'],
  ['x  ⇧click', 'select'],
  ['m', 'move'],
  ['⌫', 'delete'],
  ['⌘Z', 'undo'],
  ['[  ]', 'fold, unfold all'],
  ['esc', 'leave'],
];

/** Keys for the whole app (Mac). The book page and lists add their own. */
export default function Shortcuts() {
  const router = useRouter();
  const [help, setHelp] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        paletteStore.set(!paletteStore.get());
        return;
      }
      const field = inField(e.target);
      if (mod && !e.shiftKey && e.key.toLowerCase() === 'z' && !field) {
        e.preventDefault();
        undo();
        return;
      }
      if (mod || e.altKey) return;
      if (e.key === 'Escape' && field) {
        (e.target as HTMLElement).blur();
        return;
      }
      if (field || document.querySelector('[role="dialog"]')) return;
      if (e.key === '/') {
        e.preventDefault();
        if (matchMedia('(min-width: 768px)').matches) paletteStore.set(true);
        else router.push('/search/');
      } else if (e.key === '?') {
        e.preventDefault();
        setHelp(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router]);

  return (
    <>
      <Suspense>
        <CommandPalette />
      </Suspense>
      <Sheet open={help} onClose={() => setHelp(false)} label="Keys">
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-[14px]">
          {HELP.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="font-mono text-[13px] text-ink">{k}</dt>
              <dd className="text-muted">{v}</dd>
            </div>
          ))}
        </dl>
      </Sheet>
    </>
  );
}
