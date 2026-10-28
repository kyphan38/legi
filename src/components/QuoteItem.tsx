'use client';

import { memo, useRef } from 'react';

import { AnswerLine } from '@/components/AnswerPicker';
import { StarIcon } from '@/components/Icons';
import QuoteText from '@/components/QuoteText';
import type { QuoteRow } from '@/types/legi';

const LONG_PRESS_MS = 450;

type Props = {
  quote: QuoteRow;
  selected?: boolean;
  focused?: boolean;
  selecting?: boolean;
  /** Small extra line under the quote (e.g. the answer of a question). */
  footer?: React.ReactNode;
  onOpen: (q: QuoteRow) => void;
  onMenu: (q: QuoteRow) => void;
  onToggle: (q: QuoteRow) => void;
  riseIndex?: number;
  /** Added while the list is on screen: rises at once. */
  rose?: boolean;
  /** Removed from the list: slides out, takes no input. */
  going?: boolean;
};

/** One quote in read mode. Tap = edit (or select while selecting), long press / right click = menu. */
function QuoteItem({ quote, selected, focused, selecting, footer, onOpen, onMenu, onToggle, riseIndex, rose, going }: Props) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressed = useRef(false);
  const start = useRef<{ x: number; y: number } | null>(null);

  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  const kindClass = quote.kind === 'quote' ? 'quote-text' : 'thought-text';
  const rise = !going && (rose || (riseIndex !== undefined && riseIndex < 12));

  return (
    <article
      id={`q-${quote.id}`}
      data-quote={quote.id}
      tabIndex={-1}
      className={`qrow group no-callout relative -mx-3 cursor-text rounded-md px-3 py-1.5 outline-none transition-colors ${selected ? 'bg-wash' : ''} ${focused ? 'shadow-[inset_2px_0_0_var(--faint)]' : ''} ${rise ? 'rise' : ''} ${going ? 'row-out' : ''}`}
      style={rise && !rose && riseIndex !== undefined ? { animationDelay: `${riseIndex * 25}ms` } : undefined}
      aria-hidden={going || undefined}
      inert={going}
      onPointerDown={(e) => {
        pressed.current = false;
        if (e.pointerType === 'mouse') return;
        start.current = { x: e.clientX, y: e.clientY };
        timer.current = setTimeout(() => {
          pressed.current = true;
          navigator.vibrate?.(8);
          onMenu(quote);
        }, LONG_PRESS_MS);
      }}
      onPointerMove={(e) => {
        if (start.current && Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 8) cancel();
      }}
      onPointerUp={cancel}
      onPointerCancel={cancel}
      onContextMenu={(e) => {
        e.preventDefault();
        cancel();
        onMenu(quote);
      }}
      onClick={(e) => {
        if (pressed.current) return;
        if (selecting || e.shiftKey) onToggle(quote);
        else onOpen(quote);
      }}
    >
      <div className="flex items-start gap-3">
        <div className={`min-w-0 flex-1 ${kindClass}`}>
          {quote.kind === 'question' && <span className="mr-2 align-[0.1em] text-[12px] text-faint">question</span>}
          <QuoteText text={quote.text} />
        </div>
        {/* The page is for finding the line again in the paper book: shown on hover, and in the editor. */}
        <div className="flex w-8 shrink-0 flex-col items-end gap-1 pt-[0.5em] text-[12px] text-faint tabular-nums">
          {/* Mac: a visible way to the menu (right click / long press are hidden). */}
          <button
            type="button"
            aria-label="More"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onMenu(quote);
            }}
            className="-mt-1 hidden px-1 leading-none opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 hover:text-ink md:block"
          >
            ···
          </button>
          {quote.favorite && <StarIcon size={11} filled />}
          {quote.page !== null && <span className="opacity-0 transition-opacity group-hover:opacity-100">{quote.page}</span>}
        </div>
      </div>
      {quote.note && <p className="mt-1 mr-11 pl-4 text-[14px] leading-relaxed whitespace-pre-wrap text-muted">{quote.note}</p>}
      {quote.kind === 'question' && quote.answeredBy && <AnswerLine id={quote.answeredBy} />}
      {footer}
    </article>
  );
}

export default memo(QuoteItem);
