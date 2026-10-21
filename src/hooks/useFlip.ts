'use client';

import { useLayoutEffect, useRef } from 'react';

import { reducedMotion } from '@/lib/motion';

/**
 * FLIP for a list of quote rows: when rows move, each one slides from its old spot to its new one.
 * Rows are found by their `q-<id>` element id. Positions are kept in page coordinates, so
 * scrolling between two changes never counts as a move. A change of `scope` (another fold state)
 * only records the new spots.
 */
export function useFlip(order: string[], scope: string) {
  const last = useRef(new Map<string, number>());
  const lastScope = useRef(scope);
  const key = order.join('|');

  useLayoutEffect(() => {
    const next = new Map<string, number>();
    const els = new Map<string, HTMLElement>();
    for (const id of key ? key.split('|') : []) {
      const el = document.getElementById(`q-${id}`);
      if (!el) continue;
      els.set(id, el);
      next.set(id, el.getBoundingClientRect().top + window.scrollY);
    }
    if (!reducedMotion() && lastScope.current === scope) {
      next.forEach((top, id) => {
        const before = last.current.get(id);
        const el = els.get(id);
        if (before === undefined || !el || Math.abs(before - top) < 1 || typeof el.animate !== 'function') return;
        el.animate([{ transform: `translateY(${before - top}px)` }, { transform: 'translateY(0)' }], {
          duration: 260,
          easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
        });
      });
    }
    last.current = next;
    lastScope.current = scope;
  }, [key, scope]);
}
