'use client';

import Link from 'next/link';
import { useEffect, useSyncExternalStore, type MouseEvent, type ReactNode } from 'react';

import { typingStore } from '@/lib/activity';
import { reducedMotion } from '@/lib/motion';

export type Place = 'shelf' | 'daily' | 'search' | 'settings';

const HREF: Record<Place, string> = { shelf: '/shelf/', daily: '/?daily=1', search: '/search/', settings: '/settings/' };

/**
 * legi's own nav (DESIGN.md "Nav: one signature per app"): book-like serif
 * words with wide gaps, the current place upright in ink, the others faint
 * italic. Fades while typing, comes back on scroll or a tap outside a text
 * field. Sticks to the top: it pulls itself over .paper's top padding so the
 * page looks the same before scrolling. A tap on its empty space scrolls to
 * the top, like an iOS title bar.
 */
export default function TopBar({ current, left }: { current: Place | null; left?: ReactNode }) {
  const typing = useSyncExternalStore(typingStore.subscribe, typingStore.get, typingStore.getServer);
  const right: Place[] = ['daily', 'search', 'settings'];

  useEffect(() => {
    const wake = () => typingStore.set(false);
    const onPointer = (e: PointerEvent) => {
      if (!(e.target instanceof HTMLTextAreaElement)) wake();
    };
    document.addEventListener('pointerdown', onPointer);
    window.addEventListener('wheel', wake, { passive: true });
    window.addEventListener('touchmove', wake, { passive: true });
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('wheel', wake);
      window.removeEventListener('touchmove', wake);
    };
  }, []);

  const toTop = (e: MouseEvent<HTMLElement>) => {
    if ((e.target as Element).closest('a, button, input, textarea')) return;
    window.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' });
  };

  return (
    <header
      data-topbar
      onClick={toTop}
      className="sticky top-0 z-20 -mx-5 -mt-[calc(env(safe-area-inset-top)+20px)] flex bg-bg px-5 pt-[calc(env(safe-area-inset-top)+20px)] pb-2 -mb-2 font-serif text-[15px] text-faint"
    >
      <div className="flex min-h-6 min-w-0 flex-1 items-baseline justify-between gap-4 transition-opacity duration-700" style={{ opacity: typing ? 0.12 : 1 }}>
        <div className="min-w-0 truncate">
          {left ??
            (current === 'shelf' ? (
              <span className="text-ink">shelf</span>
            ) : (
              <Link href={HREF.shelf} className="py-2 italic hover:text-ink">
                shelf
              </Link>
            ))}
        </div>
        <nav className="flex shrink-0 items-baseline gap-[18px]">
          {right.map((p) =>
            p === current ? (
              <span key={p} className="text-ink">
                {p}
              </span>
            ) : (
              <Link key={p} href={HREF[p]} className="py-2 italic hover:text-ink">
                {p}
              </Link>
            ),
          )}
        </nav>
      </div>
    </header>
  );
}
