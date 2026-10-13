// ============================================================
// legi - Typing or not
//
// RAM only. Used for two things:
// - typingStore: the top corner links fade while typing.
// - lastInputAt: Today only moves to the new day after a long typing pause.
// ============================================================

import { memoryStore } from '@/lib/store';

export const typingStore = memoryStore(false);

let lastInput = 0;

export function markInput(): void {
  lastInput = Date.now();
  typingStore.set(true);
}

export function lastInputAt(): number {
  return lastInput;
}
