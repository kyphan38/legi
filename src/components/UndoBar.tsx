'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';

import { lastUndoStore, undo } from '@/lib/undo';

const SHOW_MS = 5000;

/** "Deleted · undo" for 5 seconds after a delete, move, merge or split. The only toast-like thing in legi. */
export default function UndoBar() {
  const entry = useSyncExternalStore(lastUndoStore.subscribe, lastUndoStore.get, lastUndoStore.getServer);
  const [hidden, setHidden] = useState<number | null>(null);

  useEffect(() => {
    if (!entry) return;
    const t = setTimeout(() => setHidden(entry.id), Math.max(0, entry.at + SHOW_MS - Date.now()));
    return () => clearTimeout(t);
  }, [entry]);

  if (!entry || hidden === entry.id) return null;
  return (
    <div className="fade-in pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+92px)] z-40 flex justify-center">
      <div className="pointer-events-auto flex items-baseline gap-3 rounded-full border border-line bg-surface px-4 py-2 text-[13px] text-muted shadow-sm">
        <span>{entry.label}</span>
        <span className="text-faint">·</span>
        <button type="button" onClick={() => undo()} className="text-ink">
          undo
        </button>
      </div>
    </div>
  );
}
