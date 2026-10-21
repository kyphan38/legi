'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';

import { usePresence } from '@/hooks/usePresence';
import { lastUndoStore, undo, type UndoEntry } from '@/lib/undo';

const SHOW_MS = 5000;
/** Matches `.fade-out` in globals.css. */
const EXIT_MS = 200;

/** "Deleted · undo" for 5 seconds after a delete, move, merge or split. The only toast-like thing in legi. */
export default function UndoBar() {
  const entry = useSyncExternalStore(lastUndoStore.subscribe, lastUndoStore.get, lastUndoStore.getServer);
  const [hidden, setHidden] = useState<number | null>(null);
  // After "undo" the store is empty; the last entry stays for the fade-out so the text does not change.
  // Derived during render, so the bar never blinks out for a frame.
  const [last, setLast] = useState<UndoEntry | null>(entry);
  if (entry && entry !== last) setLast(entry);

  useEffect(() => {
    if (!entry) return;
    const t = setTimeout(() => setHidden(entry.id), Math.max(0, entry.at + SHOW_MS - Date.now()));
    return () => clearTimeout(t);
  }, [entry]);

  const visible = entry !== null && hidden !== entry.id;
  const { mounted, leaving } = usePresence(visible, EXIT_MS);
  const shown = entry ?? last;
  if (!mounted || !shown) return null;

  return (
    <div
      // A new entry is a new bar: its own fade-in.
      key={shown.id}
      className={`${leaving ? 'fade-out' : 'fade-in'} pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+92px)] z-40 flex justify-center`}
      aria-hidden={leaving || undefined}
    >
      <div
        className={`${leaving ? 'pointer-events-none' : 'pointer-events-auto'} flex items-baseline gap-3 rounded-full border border-line bg-surface px-4 py-2 text-[13px] text-muted shadow-sm`}
      >
        <span>{shown.label}</span>
        <span className="text-faint">·</span>
        <button type="button" disabled={leaving} onClick={() => undo()} className="text-ink">
          undo
        </button>
      </div>
    </div>
  );
}
