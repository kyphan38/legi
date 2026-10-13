// ============================================================
// legi - Undo stack (RAM only, last 20 actions)
//
// Delete, move, merge and split push an entry. The UndoBar shows the newest
// one for 5 seconds; ⌘Z reverts the newest at any time.
// ============================================================

import { memoryStore } from '@/lib/store';

export type UndoEntry = { id: number; label: string; revert: () => void; at: number };

const MAX = 20;
let stack: UndoEntry[] = [];
let seq = 0;

/** The newest entry, for the UndoBar. */
export const lastUndoStore = memoryStore<UndoEntry | null>(null);

export function pushUndo(label: string, revert: () => void, now = Date.now()): UndoEntry {
  const entry = { id: ++seq, label, revert, at: now };
  stack = [...stack, entry].slice(-MAX);
  lastUndoStore.set(entry);
  return entry;
}

/** Reverts the newest entry. Returns false when there is nothing to undo. */
export function undo(): boolean {
  const entry = stack.at(-1);
  if (!entry) return false;
  stack = stack.slice(0, -1);
  lastUndoStore.set(null);
  entry.revert();
  return true;
}

export function undoSize(): number {
  return stack.length;
}

/** Tests only. */
export function resetUndo(): void {
  stack = [];
  lastUndoStore.set(null);
}
