'use client';

// ============================================================
// legi - Edit one quote in place
//
// Autosave 1s after the last key. tidy() runs only on done / leave, never
// while typing. If another device changed the text meanwhile, the two
// versions are merged (mergeTexts), never overwritten.
// ============================================================

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import Link from 'next/link';

import AnswerPicker from '@/components/AnswerPicker';
import GrowText, { isComposing } from '@/components/GrowText';
import { StarIcon } from '@/components/Icons';
import { useLibrary } from '@/contexts/LibraryContext';
import { useSaveOnLeave } from '@/hooks/useSaveOnLeave';
import { findSimilar } from '@/lib/dup';
import { toggleEmph } from '@/lib/emph';
import { mergeTexts } from '@/lib/merge-text';
import { splitQuote, trashQuotes, updateQuote } from '@/lib/repo';
import { tidy } from '@/lib/typo';
import type { QuoteKind, QuoteRow } from '@/types/legi';

const SAVE_MS = 1000;

type Props = {
  uid: string;
  quote: QuoteRow;
  kinds?: QuoteKind[];
  onDone: () => void;
  /** Extra controls (P5: "answered by" for questions). */
  extra?: React.ReactNode;
};

export default function QuoteEditor({ uid, quote, kinds = ['quote', 'thought', 'question'], onDone, extra }: Props) {
  const { dupIndex, liveQuotes, books } = useLibrary();
  const [text, setText] = useState(quote.text);
  const [note, setNote] = useState(quote.note);
  const [page, setPage] = useState(quote.page ? String(quote.page) : '');
  const [kind, setKind] = useState<QuoteKind>(quote.kind);
  const [answering, setAnswering] = useState(false);
  const base = useRef({ text: quote.text, note: quote.note });
  const latest = useRef({ text, note, page, kind });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const pending = useSaveOnLeave();
  const remote = useRef(quote);

  useEffect(() => {
    remote.current = quote;
  }, [quote]);

  useEffect(() => {
    latest.current = { text, note, page, kind };
  }, [text, note, page, kind]);

  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, []);

  const save = useCallback(
    (final: boolean) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      const cur = latest.current;
      const r = remote.current;
      let t = r.text !== base.current.text ? mergeTexts(r.text, cur.text) : cur.text;
      let n = r.note !== base.current.note ? mergeTexts(r.note, cur.note) : cur.note;
      if (final) {
        t = tidy(t);
        n = tidy(n);
      }
      if (!t.trim()) return;
      const p = Number(cur.page) > 0 ? Math.min(20000, Math.floor(Number(cur.page))) : null;
      if (t === r.text && n === r.note && p === r.page && cur.kind === r.kind) return;
      base.current = { text: t, note: n };
      updateQuote(uid, quote.id, { text: t, note: n, page: p, kind: cur.kind });
    },
    [uid, quote.id],
  );

  const schedule = useCallback(() => {
    pending.set(() => save(false));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => pending.flush(), SAVE_MS);
  }, [pending, save]);

  const closed = useRef(false);
  const done = useCallback(() => {
    if (closed.current) return;
    closed.current = true;
    pending.clear();
    if (!latest.current.text.trim()) {
      trashQuotes(uid, [quote.id]);
    } else {
      save(true);
    }
    onDone();
  }, [pending, save, uid, quote.id, onDone]);

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (isComposing(e)) return;
    if (e.key === 'Escape' || (e.key === 'Enter' && (e.metaKey || e.ctrlKey))) {
      e.preventDefault();
      done();
    } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
      e.preventDefault();
      const el = e.currentTarget;
      const res = toggleEmph(el.value, el.selectionStart, el.selectionEnd);
      setText(res.text);
      schedule();
      requestAnimationFrame(() => el.setSelectionRange(res.start, res.end));
    }
  };

  const similar = useMemo(() => findSimilar(text, dupIndex, quote.id), [text, dupIndex, quote.id]);
  const similarQuote = similar ? liveQuotes.find((q) => q.id === similar.id) : null;

  const split = () => {
    const el = textRef.current;
    if (!el) return;
    pending.clear();
    save(false);
    splitQuote(uid, { ...quote, text: latest.current.text }, el.selectionStart);
    closed.current = true;
    onDone();
  };

  return (
    <div
      className="-mx-3 rounded-md bg-surface-2 px-3 py-2"
      onBlur={(e) => {
        // Leaving the whole editor (not moving between its fields) closes it.
        if (answering) return;
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) done();
      }}
    >
      <GrowText
        textareaRef={textRef}
        value={text}
        onChange={(v) => {
          setText(v);
          schedule();
        }}
        onKeyDown={onKey}
        label="Quote"
        wrapClassName={kind === 'quote' ? 'quote-text' : 'thought-text text-ink'}
      />
      <GrowText
        value={note}
        onChange={(v) => {
          setNote(v);
          schedule();
        }}
        onKeyDown={onKey}
        label="Note"
        placeholder="note"
        wrapClassName="mt-1 pl-4 text-[16px] leading-relaxed text-muted"
      />
      {similarQuote && (
        <p className="mt-1 text-[13px] text-muted">
          Similar in{' '}
          <Link href={similarQuote.bookId ? `/book/?id=${similarQuote.bookId}&q=${similarQuote.id}` : `/inbox/?q=${similarQuote.id}`} className="text-ink">
            {similarQuote.bookId ? books.get(similarQuote.bookId)?.title : 'Inbox'}
            {similarQuote.page ? `, p. ${similarQuote.page}` : ''}
          </Link>
        </p>
      )}
      <div
        className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-faint"
        // iOS does not focus buttons on tap: keep focus in the text so blur does not close the editor first.
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest('button')) e.preventDefault();
        }}
      >
        <label className="flex items-baseline gap-1">
          <span>p.</span>
          <input
            value={page}
            onChange={(e) => {
              setPage(e.target.value.replace(/\D/g, '').slice(0, 5));
              schedule();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === 'Escape') {
                e.preventDefault();
                done();
              }
            }}
            inputMode="numeric"
            aria-label="Page"
            className="w-[4.5ch] bg-transparent text-[16px] text-ink tabular-nums outline-none"
          />
        </label>
        <div className="flex gap-2" role="radiogroup" aria-label="Kind">
          {kinds.map((k, i) => (
            <span key={k} className="flex gap-2">
              {i > 0 && <span aria-hidden>|</span>}
              <button
                type="button"
                role="radio"
                aria-checked={kind === k}
                onClick={() => {
                  setKind(k);
                  schedule();
                }}
                className={kind === k ? 'text-ink' : 'hover:text-muted'}
              >
                {k}
              </button>
            </span>
          ))}
        </div>
        <button
          type="button"
          aria-label={quote.favorite ? 'Unstar' : 'Star'}
          aria-pressed={quote.favorite}
          onClick={() => updateQuote(uid, quote.id, { favorite: !quote.favorite })}
          className={quote.favorite ? 'text-ink' : 'hover:text-muted'}
        >
          <StarIcon size={13} filled={quote.favorite} />
        </button>
        <button type="button" onClick={split} className="hover:text-muted">
          split here
        </button>
        {kind === 'question' && (
          <button type="button" onClick={() => setAnswering(true)} className="hover:text-muted">
            {quote.answeredBy ? 'answer' : 'answered by…'}
          </button>
        )}
        {extra}
        <button
          type="button"
          onClick={() => {
            closed.current = true;
            pending.clear();
            trashQuotes(uid, [quote.id]);
            onDone();
          }}
          className="hover:text-muted"
        >
          delete
        </button>
        <button type="button" onClick={done} className="ml-auto text-ink">
          done
        </button>
      </div>
      {answering && <AnswerPicker uid={uid} question={quote} open onClose={() => setAnswering(false)} />}
    </div>
  );
}
