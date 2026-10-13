'use client';

import Sheet from '@/components/Sheet';
import type { QuoteRow } from '@/types/legi';

export type MenuAction = 'edit' | 'favorite' | 'move' | 'select' | 'delete' | 'slow';

/** Long press / right click menu for one quote. */
export default function QuoteMenu({ quote, onClose, onAction }: { quote: QuoteRow | null; onClose: () => void; onAction: (a: MenuAction, q: QuoteRow) => void }) {
  const items: { a: MenuAction; label: string }[] = [
    { a: 'edit', label: 'edit' },
    { a: 'favorite', label: quote?.favorite ? 'unstar' : 'star' },
    { a: 'move', label: 'move' },
    { a: 'select', label: 'select' },
    { a: 'slow', label: 'read slowly from here' },
    { a: 'delete', label: 'delete' },
  ];
  return (
    <Sheet open={quote !== null} onClose={onClose} label="Quote">
      {quote && (
        <>
          <p className="mb-3 line-clamp-2 font-serif text-[15px] leading-relaxed text-muted">{quote.text.replace(/\*\*/g, '')}</p>
          <ul className="text-[15px]">
            {items.map((it) => (
              <li key={it.a}>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onAction(it.a, quote);
                  }}
                  className="w-full py-2.5 text-left text-ink"
                >
                  {it.label}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </Sheet>
  );
}
