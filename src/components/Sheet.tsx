'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { usePresence } from '@/hooks/usePresence';
import { dragOffset, reducedMotion, sheetShouldClose } from '@/lib/motion';

/** Matches `.fade-out` / `.sheet-down` in globals.css. */
const EXIT_MS = 200;
const SWIPE_OUT_MS = 180;
/** Below this the drag was a tap on the handle, even if it was quick. */
const MIN_SWIPE_PX = 16;

// Page scroll is locked while any sheet is on screen. A counter, because one
// sheet can open while the one before it is still sliding out.
let locks = 0;
let savedOverflow = '';
function lockScroll() {
  if (locks++ === 0) {
    savedOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
}
function unlockScroll() {
  if (--locks === 0) document.body.style.overflow = savedOverflow;
}

/**
 * Bottom sheet on phones, a centered panel on wide screens. Esc, a tap outside or a swipe down
 * (on a phone, from the handle) closes it; it slides out before it unmounts.
 */
export default function Sheet({ open, onClose, label, children }: { open: boolean; onClose: () => void; label: string; children: ReactNode }) {
  const { mounted, leaving } = usePresence(open, EXIT_MS);

  // The content of the last open frame stays on screen while it slides out: a parent that
  // clears its data when it closes (QuoteMenu) would otherwise show an empty panel.
  const [frozen, setFrozen] = useState<ReactNode>(children);
  if (open && frozen !== children) setFrozen(children);

  const mover = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const backdrop = useRef<HTMLButtonElement>(null);
  const drag = useRef<{ y: number; lastY: number; lastT: number; v: number; dy: number } | null>(null);

  useEffect(() => {
    if (!mounted) return;
    lockScroll();
    return unlockScroll;
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        // A second Esc while it slides out does nothing.
        if (open) onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [mounted, open, onClose]);

  if (!mounted) return null;

  // Drag writes styles through refs: no re-render per pointer move.
  const setDrag = (offset: number, height: number, transition: string) => {
    const m = mover.current;
    const b = backdrop.current;
    if (!m || !b) return;
    m.style.transition = transition;
    b.style.transition = transition.replace('transform', 'opacity');
    m.style.transform = offset === 0 ? '' : `translateY(${offset}px)`;
    b.style.opacity = offset <= 0 ? '' : String(Math.max(0, 1 - offset / height));
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!open || e.button !== 0 || !matchMedia('(max-width: 767px)').matches) return;
    drag.current = { y: e.clientY, lastY: e.clientY, lastT: e.timeStamp, v: 0, dy: 0 };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dt = e.timeStamp - d.lastT;
    if (dt > 0) d.v = (e.clientY - d.lastY) / dt;
    d.lastY = e.clientY;
    d.lastT = e.timeStamp;
    d.dy = e.clientY - d.y;
    setDrag(dragOffset(d.dy), panel.current?.offsetHeight ?? 1, 'none');
  };

  const onPointerEnd = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    const height = panel.current?.offsetHeight ?? 1;
    const swiped = e.type === 'pointerup' && d.dy > MIN_SWIPE_PX && sheetShouldClose(d.dy, height, d.v);
    if (!swiped) {
      setDrag(0, height, 'transform 200ms var(--ease-soft)');
      return;
    }
    if (!reducedMotion()) {
      // Keep sliding from where the finger let go, no jump back first. `onClose` then
      // starts the usual exit, which is hidden behind this.
      const m = mover.current;
      const b = backdrop.current;
      if (m && b) {
        m.style.transition = `transform ${SWIPE_OUT_MS}ms ease-in`;
        b.style.transition = `opacity ${SWIPE_OUT_MS}ms ease-in`;
        m.style.transform = 'translateY(100%)';
        b.style.opacity = '0';
      }
    }
    onClose();
  };

  // Portal: a parent with backdrop-filter (the composer) would trap a fixed child.
  return createPortal(
    <div
      className={`fixed inset-0 z-50 flex items-end justify-center md:items-start md:pt-[12dvh] ${leaving ? 'pointer-events-none' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label={label}
    >
      {/* The outer layer takes the drag opacity; the inner one plays the fade. */}
      <button ref={backdrop} type="button" aria-label="Close" onClick={open ? onClose : undefined} className="absolute inset-0">
        <span className={`${leaving ? 'fade-out' : 'fade-in'} absolute inset-0 bg-black/25`} />
      </button>
      {/* `mover` takes the drag; the panel inside keeps the CSS animation, so they never overwrite each other. */}
      <div ref={mover} className="pointer-events-none relative flex w-full justify-center">
        <div
          ref={panel}
          inert={leaving}
          className={`${leaving ? 'sheet-down' : 'sheet-up'} pointer-events-auto relative max-h-[80dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-line bg-surface px-5 pt-4 pb-[calc(env(safe-area-inset-bottom)+20px)] md:rounded-2xl md:pb-5`}
        >
          {/* Phone only: drag this handle down to close. */}
          <div
            aria-hidden="true"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerEnd}
            onPointerCancel={onPointerEnd}
            className="-mt-4 mb-1 flex touch-none select-none justify-center pt-2.5 pb-3 md:hidden"
          >
            <span className="h-1 w-10 rounded-full bg-line" />
          </div>
          {open ? children : frozen}
        </div>
      </div>
    </div>,
    document.body,
  );
}
