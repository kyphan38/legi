'use client';

// ============================================================
// legi - Shared behavior of a quote list (book page, Inbox)
//
// Edit in place, long-press menu, select several, move, merge, favorite,
// delete, and the desktop keys:
//   j/k next/prev · e or Enter edit · x select · m move · f star
//   Backspace/Delete delete · Esc leave
// ============================================================

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

import MoveSheet from '@/components/MoveSheet';
import QuoteEditor from '@/components/QuoteEditor';
import QuoteItem from '@/components/QuoteItem';
import QuoteMenu, { type MenuAction } from '@/components/QuoteMenu';
import { mergeQuotes, moveQuotes, trashQuotes, updateQuote } from '@/lib/repo';
import type { QuoteKind, QuoteRow } from '@/types/legi';

export function inField(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el) return false;
  return el.tagName === 'TEXTAREA' || el.tagName === 'INPUT' || el.isContentEditable;
}

export function scrollToQuote(id: string, flash = false) {
  const el = document.getElementById(`q-${id}`);
  if (!el) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
  if (flash) {
    el.classList.remove('flash');
    void el.offsetWidth;
    el.classList.add('flash');
  }
}

export function useQuoteBoard(
  uid: string,
  ordered: QuoteRow[],
  opts: { bookId: string | null; kinds?: QuoteKind[]; footer?: (q: QuoteRow) => React.ReactNode; editorExtra?: (q: QuoteRow) => React.ReactNode } = { bookId: null },
) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [menu, setMenu] = useState<QuoteRow | null>(null);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [selecting, setSelecting] = useState(false);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [moving, setMoving] = useState<QuoteRow[] | null>(null);

  const byId = useMemo(() => new Map(ordered.map((q) => [q.id, q])), [ordered]);
  const selectedRows = useMemo(() => ordered.filter((q) => selected.has(q.id)), [ordered, selected]);

  const clearSelection = useCallback(() => {
    setSelected(new Set());
    setSelecting(false);
  }, []);

  const toggle = useCallback((q: QuoteRow) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(q.id)) next.delete(q.id);
      else next.add(q.id);
      setSelecting(next.size > 0);
      return next;
    });
  }, []);

  const act = useCallback(
    (a: MenuAction, q: QuoteRow) => {
      if (a === 'edit') setEditingId(q.id);
      else if (a === 'favorite') updateQuote(uid, q.id, { favorite: !q.favorite });
      else if (a === 'move') setMoving([q]);
      else if (a === 'delete') trashQuotes(uid, [q.id]);
      else if (a === 'select') {
        setSelecting(true);
        setSelected(new Set([q.id]));
      } else if (a === 'slow' && q.bookId) router.push(`/slow/?id=${q.bookId}&from=${q.id}`);
    },
    [uid, router],
  );

  // A click edits; only j/k shows the focus bar.
  const open = useCallback((q: QuoteRow) => {
    setFocusedId(null);
    setEditingId(q.id);
  }, []);

  // Desktop keys.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || inField(e.target) || editingId) return;
      if (document.querySelector('[role="dialog"]')) return;
      const i = focusedId ? ordered.findIndex((q) => q.id === focusedId) : -1;
      const focusAt = (n: number) => {
        const q = ordered[Math.max(0, Math.min(ordered.length - 1, n))];
        if (!q) return;
        setFocusedId(q.id);
        scrollToQuote(q.id);
      };
      const cur = i >= 0 ? ordered[i] : null;
      switch (e.key) {
        case 'j':
          e.preventDefault();
          focusAt(i + 1);
          break;
        case 'k':
          e.preventDefault();
          focusAt(i < 0 ? ordered.length - 1 : i - 1);
          break;
        case 'e':
        case 'Enter':
          if (cur) {
            e.preventDefault();
            setEditingId(cur.id);
          }
          break;
        case 'x':
          if (cur) {
            e.preventDefault();
            setSelecting(true);
            toggle(cur);
          }
          break;
        case 'm':
          if (selectedRows.length) setMoving(selectedRows);
          else if (cur) setMoving([cur]);
          break;
        case 'f':
          if (cur) updateQuote(uid, cur.id, { favorite: !cur.favorite });
          break;
        case 'Backspace':
        case 'Delete':
          if (selectedRows.length) {
            e.preventDefault();
            trashQuotes(uid, selectedRows.map((q) => q.id));
            clearSelection();
          } else if (cur) {
            e.preventDefault();
            trashQuotes(uid, [cur.id]);
            focusAt(i + 1 < ordered.length ? i + 1 : i - 1);
          }
          break;
        case 'Escape':
          if (selecting) clearSelection();
          else setFocusedId(null);
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ordered, focusedId, editingId, selectedRows, selecting, toggle, clearSelection, uid]);

  const renderItem = (q: QuoteRow, index?: number) =>
    editingId === q.id ? (
      <div key={q.id} id={`q-${q.id}`}>
        <QuoteEditor uid={uid} quote={q} kinds={opts.kinds} onDone={() => setEditingId(null)} extra={opts.editorExtra?.(q)} />
      </div>
    ) : (
      <QuoteItem
        key={q.id}
        quote={q}
        selected={selected.has(q.id)}
        focused={focusedId === q.id}
        selecting={selecting}
        onOpen={open}
        onMenu={setMenu}
        onToggle={toggle}
        riseIndex={index}
        footer={opts.footer?.(q)}
      />
    );

  const sameBook = selectedRows.length > 1 && selectedRows.every((q) => q.bookId === selectedRows[0].bookId);

  const overlays = (
    <>
      <QuoteMenu quote={menu} onClose={() => setMenu(null)} onAction={act} />
      <MoveSheet
        open={moving !== null}
        startBookId={opts.bookId}
        onClose={() => setMoving(null)}
        onPick={(bookId, sectionId) => {
          if (moving) moveQuotes(uid, moving, bookId, sectionId);
          clearSelection();
        }}
      />
      {selecting && (
        <div className="fade-in fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg">
          <div className="mx-auto flex w-full max-w-[36rem] items-center gap-4 px-5 pt-3 pb-[calc(env(safe-area-inset-bottom)+14px)] text-[14px]">
            <span className="text-muted">{selected.size} selected</span>
            <button type="button" onClick={() => setMoving(selectedRows)} disabled={!selectedRows.length} className="ml-auto text-ink disabled:text-faint">
              move
            </button>
            {sameBook && (
              <button
                type="button"
                onClick={() => {
                  mergeQuotes(uid, selectedRows);
                  clearSelection();
                }}
                className="text-ink"
              >
                merge
              </button>
            )}
            <button
              type="button"
              disabled={!selectedRows.length}
              onClick={() => {
                trashQuotes(uid, selectedRows.map((q) => q.id));
                clearSelection();
              }}
              className="text-ink disabled:text-faint"
            >
              delete
            </button>
            <button type="button" onClick={clearSelection} className="text-faint hover:text-ink">
              cancel
            </button>
          </div>
        </div>
      )}
    </>
  );

  return { renderItem, overlays, editingId, setEditingId, selecting, focusedId, setFocusedId, byId };
}
