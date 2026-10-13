'use client';

import Link from 'next/link';
import { Fragment, useEffect, useSyncExternalStore, type ReactNode } from 'react';

import { typingStore } from '@/lib/activity';

export type Place = 'shelf' | 'search' | 'settings';

const HREF: Record<Place, string> = { shelf: '/shelf/', search: '/search/', settings: '/settings/' };

/**
 * One small line instead of a tab bar (from hodi). Fades while typing, comes
 * back on scroll or a tap outside a text field.
 */
export default function TopBar({ current, left }: { current: Place | null; left?: ReactNode }) {
  const typing = useSyncExternalStore(typingStore.subscribe, typingStore.get, typingStore.getServer);
  const right: Place[] = ['search', 'settings'];

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

  return (
    <header
      className="flex min-h-6 items-baseline justify-between gap-4 text-[13px] text-faint transition-opacity duration-700"
      style={{ opacity: typing ? 0.12 : 1 }}
    >
      <div className="min-w-0 truncate">
        {left ??
          (current === 'shelf' ? (
            <span className="text-ink">shelf</span>
          ) : (
            <Link href={HREF.shelf} className="py-2 hover:text-ink">
              shelf
            </Link>
          ))}
      </div>
      <nav className="flex shrink-0 items-baseline">
        {right.map((p, i) => (
          <Fragment key={p}>
            {i > 0 && <span className="px-1.5">·</span>}
            {p === current ? (
              <span className="text-ink">{p}</span>
            ) : (
              <Link href={HREF[p]} className="py-2 hover:text-ink">
                {p}
              </Link>
            )}
          </Fragment>
        ))}
      </nav>
    </header>
  );
}
