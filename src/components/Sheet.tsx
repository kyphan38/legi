'use client';

import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/** Bottom sheet on phones, a centered panel on wide screens. Esc or a tap outside closes it. */
export default function Sheet({ open, onClose, label, children }: { open: boolean; onClose: () => void; label: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  // Portal: a parent with backdrop-filter (the composer) would trap a fixed child.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-start md:pt-[12dvh]" role="dialog" aria-modal="true" aria-label={label}>
      <button type="button" aria-label="Close" onClick={onClose} className="fade-in absolute inset-0 bg-black/25" />
      <div className="sheet-up relative max-h-[80dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-line bg-surface px-5 pt-4 pb-[calc(env(safe-area-inset-bottom)+20px)] md:rounded-2xl md:pb-5">
        {children}
      </div>
    </div>,
    document.body,
  );
}
