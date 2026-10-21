'use client';

import { useEffect, useState } from 'react';

import { reducedMotion, rowChanges } from '@/lib/motion';
import type { QuoteRow } from '@/types/legi';

/** Matches `.row-out` in globals.css. */
const LEAVE_MS = 180;

type Gone = { quote: QuoteRow; at: number };

/**
 * Tells a quote list which rows a live update just added (`rose`) or removed (`goingIds`; they stay
 * in `shown` for 180ms so they can slide out). A change of `scope`, an unsettled load and a big
 * swap of rows play nothing: the list is replaced, not edited. A row being edited never slides out.
 */
export function useRowMotion(rows: QuoteRow[], scope: string, settled: boolean, editingId: string | null) {
  const [seen, setSeen] = useState({ scope, rows });
  const [leaving, setLeaving] = useState<Gone[]>([]);
  const [rose, setRose] = useState<Set<string>>(() => new Set());

  // Derived during render, so a leaving row never blinks out for one frame.
  if (rows !== seen.rows) {
    if (scope !== seen.scope) {
      setLeaving([]);
      setRose(new Set());
    } else if (settled && !reducedMotion()) {
      const delta = rowChanges(
        seen.rows.map((q) => q.id),
        rows.map((q) => q.id),
      );
      if (delta) {
        const gone: Gone[] = [];
        seen.rows.forEach((quote, at) => {
          if (delta.removed.includes(quote.id) && quote.id !== editingId) gone.push({ quote, at });
        });
        if (gone.length > 0) setLeaving((l) => [...l, ...gone]);
        if (delta.added.length > 0) setRose((r) => new Set([...r, ...delta.added]));
      }
    }
    setSeen({ scope, rows });
  }

  useEffect(() => {
    if (leaving.length === 0) return;
    const ids = new Set(leaving.map((g) => g.quote.id));
    const timer = setTimeout(() => setLeaving((l) => l.filter((g) => !ids.has(g.quote.id))), LEAVE_MS);
    return () => clearTimeout(timer);
  }, [leaving]);

  const live = new Set(rows.map((q) => q.id));
  const going = leaving.filter((g) => !live.has(g.quote.id)).sort((a, b) => a.at - b.at);
  const goingIds = new Set(going.map((g) => g.quote.id));
  let shown = rows;
  if (going.length > 0) {
    shown = [...rows];
    for (const g of going) shown.splice(Math.min(g.at, shown.length), 0, g.quote);
  }

  return { shown, goingIds, rose };
}
