'use client';

// ============================================================
// legi - The quote composer, fixed at the bottom
//
// Keys (all wait for the IME: Telex/VNI must finish a letter first):
//   Enter on an empty last line → save · ⌘/Ctrl+Enter → save anywhere
//   Tab → page field · Esc → leave (the draft stays) · ⌘B → **emphasis**
// A blank line splits text into several quotes (asked first).
// ============================================================

import Link from 'next/link';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react';

import CameraButton from '@/components/CameraButton';
import GrowText, { isComposing } from '@/components/GrowText';
import SectionPicker from '@/components/SectionPicker';
import StatusDot from '@/components/StatusDot';
import VoiceButton from '@/components/VoiceButton';
import { useLibrary } from '@/contexts/LibraryContext';
import { clearDraft, readDraft, writeDraft } from '@/lib/draft';
import { findSimilar, MIN_CHARS } from '@/lib/dup';
import { toggleEmph } from '@/lib/emph';
import { addSection, buildTree, flatten, pathOf, sectionForPage } from '@/lib/outline';
import { takePageToken } from '@/lib/page-token';
import { isSource } from '@/lib/source';
import { cleanPaste, countBlocks, splitBlocks, type Block } from '@/lib/paste';
import { createQuotes, updateBook, type QuoteInput } from '@/lib/repo';
import { readJson, writeJson } from '@/lib/store';
import { tidy } from '@/lib/typo';
import { graphemes, looksBroken } from '@/lib/vi';
import type { BookRow, QuoteKind, Section } from '@/types/legi';

export type ComposerHandle = { focus: () => void };

type Props = {
  uid: string;
  /** null = Inbox. */
  book: BookRow | null;
  /** Called with the ids of the quotes just saved. */
  onSaved?: (ids: string[]) => void;
  /** Kinds offered; tapping the kind cycles through them. */
  kinds?: QuoteKind[];
  /** Extra controls in the row. */
  extra?: React.ReactNode;
};

type Split = { blocks: Block[]; text: string };

function ctxKey(bookId: string) {
  return `legi.ctx.${bookId}`;
}

const Composer = forwardRef<ComposerHandle, Props>(function Composer({ uid, book, onSaved, kinds = ['quote', 'thought', 'question'], extra }, ref) {
  const { liveQuotes, books, dupIndex } = useLibrary();
  const draftKey = `${uid}/${book?.id ?? 'inbox'}`;
  const [initial] = useState(() => readDraft(draftKey));
  const [text, setText] = useState(initial?.text ?? '');
  const [note, setNote] = useState(initial?.note ?? '');
  const [showNote, setShowNote] = useState(Boolean(initial?.note));
  const [page, setPage] = useState(initial?.page ?? (book?.currentPage ? String(book.currentPage) : ''));
  const [kind, setKind] = useState<QuoteKind>(initial?.kind ?? 'quote');
  // undefined in storage = never chosen; '' = "no chapter" on purpose.
  const [ctx, setCtx] = useState<string | null>(() => (book ? readJson<string>(ctxKey(book.id)) : null));
  const [picker, setPicker] = useState(false);
  const [split, setSplit] = useState<Split | null>(null);
  const [broken, setBroken] = useState(false);
  const [pasted, setPasted] = useState(false);
  const [similar, setSimilar] = useState<string | null>(null);
  const [hasSelection, setHasSelection] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const pageRef = useRef<HTMLInputElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);

  useImperativeHandle(ref, () => ({ focus: () => textRef.current?.focus() }), []);

  const sections = useMemo(() => book?.sections ?? [], [book?.sections]);
  // Sources (a channel, a site, a person) have no pages.
  const paged = !book || !isSource(book);
  // No choice yet → the last section of the book (where a reader usually is).
  const fallbackCtx = useMemo(() => flatten(buildTree(sections)).at(-1)?.section.id ?? null, [sections]);
  const storedCtx = ctx === '' ? null : ctx === null ? fallbackCtx : sections.some((s) => s.id === ctx) ? ctx : fallbackCtx;
  // The page decides the section once sections have first pages, also when the
  // page was typed earlier. A pick by hand wins until the page changes again.
  const [manual, setManual] = useState(false);
  const byPage = manual ? null : sectionForPage(sections, Number(page) > 0 ? Math.floor(Number(page)) : null);
  const validCtx = byPage ?? storedCtx;
  const path = pathOf(sections, validCtx);

  const pickCtx = useCallback(
    (id: string | null) => {
      setCtx(id ?? '');
      if (book) writeJson(ctxKey(book.id), id ?? '');
    },
    [book],
  );

  const saveDraft = useCallback(
    (next: Partial<{ text: string; note: string; page: string; kind: QuoteKind }>) => {
      const d = { text, note, page, kind, ...next, at: Date.now() };
      if (!d.text && !d.note) clearDraft(draftKey);
      else writeDraft(draftKey, d);
    },
    [draftKey, text, note, page, kind],
  );

  // Duplicate hint, 300ms after typing stops.
  useEffect(() => {
    if (Array.from(text).length < MIN_CHARS) {
      setSimilar(null);
      return;
    }
    const t = setTimeout(() => setSimilar(findSimilar(text, dupIndex)?.id ?? null), 300);
    return () => clearTimeout(t);
  }, [text, dupIndex]);

  const reset = (usedPage: number | null) => {
    setText('');
    setNote('');
    setShowNote(false);
    setSplit(null);
    setBroken(false);
    setPasted(false);
    setSimilar(null);
    if (usedPage) setPage(String(usedPage));
    clearDraft(draftKey);
    requestAnimationFrame(() => textRef.current?.focus());
  };

  const write = (blocks: Block[], pageNum: number | null, cleanNote: string, base: string | null = validCtx) => {
    let secs: Section[] = sections;
    let sectionId = base;
    // Pasted headings nest under the chosen section: # = child of it, ## = child of the last #.
    const stack: (string | null)[] = [base];
    const inputs: QuoteInput[] = [];
    for (const b of blocks) {
      if (b.type === 'heading') {
        if (!book) continue;
        const depth = Math.min(b.depth, stack.length);
        const res = addSection(secs, b.title, stack[depth - 1] ?? null);
        secs = res.sections;
        stack.length = depth;
        stack.push(res.id);
        sectionId = res.id;
        continue;
      }
      inputs.push({
        bookId: book?.id ?? null,
        sectionId: book ? sectionId : null,
        kind,
        text: b.text,
        note: '',
        page: pageNum,
        source: pasted ? 'paste' : 'typed',
      });
    }
    if (inputs.length > 0 && cleanNote) inputs[inputs.length - 1].note = cleanNote;
    if (book) {
      const patch: Partial<BookRow> = {};
      if (secs !== sections) patch.sections = secs;
      if (pageNum && (!book.currentPage || pageNum > book.currentPage)) patch.currentPage = pageNum;
      if (Object.keys(patch).length) updateBook(uid, book.id, patch);
      if (sectionId !== validCtx) pickCtx(sectionId);
    }
    const ids = createQuotes(uid, inputs);
    reset(pageNum);
    onSaved?.(ids);
  };

  const commit = () => {
    const token = takePageToken(text.trimEnd());
    const pageNum = token.page ?? (Number(page) > 0 ? Math.min(20000, Math.floor(Number(page))) : null);
    const clean = tidy(token.text);
    const cleanNote = tidy(note);
    if (!clean) return;
    const blocks = splitBlocks(clean);
    const { quotes, headings } = countBlocks(blocks);
    // "p.52" typed at the end of the text is a new page too.
    if (token.page) setManual(false);
    const base = token.page ? (sectionForPage(sections, token.page) ?? storedCtx) : validCtx;
    if (quotes > 1 || headings > 0) {
      setSplit({ blocks, text: clean });
      if (token.page) setPage(String(token.page));
      return;
    }
    write([{ type: 'quote', text: clean }], pageNum, cleanNote, base);
  };

  const confirmSplit = (asOne: boolean) => {
    if (!split) return;
    const pageNum = Number(page) > 0 ? Math.floor(Number(page)) : null;
    write(asOne ? [{ type: 'quote', text: split.text }] : split.blocks, pageNum, tidy(note));
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (isComposing(e)) return;
    const el = e.currentTarget;
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      commit();
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey && !e.altKey) {
      const atEnd = el.selectionStart === el.value.length && el.selectionEnd === el.value.length;
      if (atEnd && el.value.endsWith('\n') && el.value.trim()) {
        e.preventDefault();
        commit();
      }
      return;
    }
    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      pageRef.current?.focus();
      pageRef.current?.select();
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      el.blur();
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
      e.preventDefault();
      emphasize();
    }
  };

  const emphasize = () => {
    const el = textRef.current;
    if (!el) return;
    const res = toggleEmph(el.value, el.selectionStart, el.selectionEnd);
    if (res.text === el.value) return;
    setText(res.text);
    saveDraft({ text: res.text });
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(res.start, res.end);
    });
  };

  // Spoken text goes where the caret is (or at the end), with a space before it.
  const insertSpoken = (spoken: string) => {
    const el = textRef.current;
    const value = el?.value ?? text;
    const at = el && document.activeElement === el ? el.selectionStart : value.length;
    const before = value.slice(0, at);
    const gap = before && !/\s$/.test(before) ? ' ' : '';
    const next = before + gap + spoken + value.slice(at);
    const caret = (before + gap + spoken).length;
    setText(next);
    setSplit(null);
    saveDraft({ text: next });
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(caret, caret);
    });
  };

  const onPaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const raw = e.clipboardData.getData('text/plain');
    if (!raw) return;
    e.preventDefault();
    const clean = cleanPaste(raw);
    const el = e.currentTarget;
    const next = el.value.slice(0, el.selectionStart) + clean + el.value.slice(el.selectionEnd);
    const caret = el.selectionStart + clean.length;
    setText(next);
    setPasted(true);
    setBroken(looksBroken(raw));
    saveDraft({ text: next });
    requestAnimationFrame(() => el.setSelectionRange(caret, caret));
  };

  const similarQuote = similar ? liveQuotes.find((q) => q.id === similar) : null;
  const similarBook = similarQuote?.bookId ? books.get(similarQuote.bookId) : null;
  const counts = split ? countBlocks(split.blocks) : null;
  const canSave = text.trim().length > 0;
  // Visible characters ("ệ" = 1), without the ** of emphasis.
  const chars = graphemes(text.replace(/\*\*/g, '')).length;

  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg/95 backdrop-blur-sm" data-composer>
      <div className="mx-auto w-full max-w-[36rem] px-5 pt-1.5 pb-[calc(env(safe-area-inset-bottom)+8px)]">
        <div className="max-h-[40dvh] overflow-y-auto">
          <GrowText
            textareaRef={textRef}
            value={text}
            onChange={(v) => {
              setText(v);
              if (!v) {
                setPasted(false);
                setBroken(false);
              }
              setSplit(null);
              saveDraft({ text: v });
            }}
            onKeyDown={onKey}
            onPaste={onPaste}
            onSelect={(e) => setHasSelection(e.currentTarget.selectionStart !== e.currentTarget.selectionEnd)}
            label={kind === 'thought' ? 'Thought' : kind === 'question' ? 'Question' : 'Quote'}
            placeholder={kind === 'thought' ? 'A thought…' : kind === 'question' ? 'A question…' : 'Type a quote…'}
            wrapClassName={`py-1.5 ${kind === 'quote' ? 'quote-text' : 'thought-text text-ink'}`}
          />
          {showNote && (
            <GrowText
              textareaRef={noteRef}
              value={note}
              onChange={(v) => {
                setNote(v);
                saveDraft({ note: v });
              }}
              onKeyDown={(e) => {
                if (isComposing(e)) return;
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  commit();
                }
              }}
              label="Note"
              placeholder="Your note…"
              wrapClassName="pb-1.5 pl-4 text-[16px] leading-relaxed text-muted"
            />
          )}
        </div>

        {split && counts && (
          <p className="fade-in flex flex-wrap items-baseline gap-x-3 py-1 text-[13px] text-muted">
            <span>
              Split into {counts.quotes} {counts.quotes === 1 ? 'quote' : 'quotes'}
              {counts.headings > 0 && ` and ${counts.headings} ${counts.headings === 1 ? 'section' : 'sections'}`}?
            </span>
            <button type="button" onClick={() => confirmSplit(false)} className="text-ink">
              split
            </button>
            <button type="button" onClick={() => confirmSplit(true)} className="text-faint hover:text-ink">
              keep as one
            </button>
          </p>
        )}
        {!split && broken && <p className="py-1 text-[13px] text-muted">Text looks broken. Try a photo.</p>}
        {!split && similarQuote && (
          <p className="fade-in flex flex-wrap items-baseline gap-x-3 py-1 text-[13px] text-muted">
            <span className="min-w-0 truncate">
              Similar in {similarBook?.title ?? 'Inbox'}
              {similarQuote.page ? `, p. ${similarQuote.page}` : ''}
            </span>
            <Link
              href={similarQuote.bookId ? `/book/?id=${similarQuote.bookId}&q=${similarQuote.id}` : `/inbox/?q=${similarQuote.id}`}
              className="text-ink"
            >
              open
            </Link>
            <button type="button" onClick={commit} className="text-faint hover:text-ink">
              save anyway
            </button>
          </p>
        )}

        {/* One row of controls: where it goes, what it is, page, save. */}
        <div className="flex items-center gap-3 pt-1 text-[13px] text-faint">
          {book && (
            <button type="button" onPointerDown={(e) => e.preventDefault()} onClick={() => setPicker(true)} className="min-w-0 shrink truncate py-1.5 text-left hover:text-ink">
              {path.at(-1)?.title ?? 'no chapter'}
            </button>
          )}
          <button
            type="button"
            onPointerDown={(e) => e.preventDefault()}
            onClick={() => {
              const next = kinds[(kinds.indexOf(kind) + 1) % kinds.length];
              setKind(next);
              saveDraft({ kind: next });
            }}
            aria-label={`Kind: ${kind}. Tap to change.`}
            className="shrink-0 text-muted hover:text-ink"
          >
            {kind}
          </button>
          <button
            type="button"
            onClick={() => {
              setShowNote((v) => !v);
              requestAnimationFrame(() => (showNote ? textRef : noteRef).current?.focus());
            }}
            className={`shrink-0 ${showNote ? 'text-ink' : 'hover:text-muted'}`}
          >
            + note
          </button>
          {hasSelection && (
            <button type="button" onPointerDown={(e) => e.preventDefault()} onClick={emphasize} aria-label="Emphasis" className="fade-in font-semibold hover:text-muted">
              B
            </button>
          )}
          <CameraButton uid={uid} bookId={book?.id ?? null} sectionId={validCtx} />
          <VoiceButton onText={insertSpoken} />
          {extra}
          <span className="ml-auto" />
          {text && (
            <span className="shrink-0 text-[12px] tabular-nums" aria-label={`${chars} characters`}>
              {chars}
            </span>
          )}
          {paged && (
            <label className="flex shrink-0 items-baseline gap-0.5">
              <span>p.</span>
              <input
                ref={pageRef}
                value={page}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, '').slice(0, 5);
                  setPage(v);
                  saveDraft({ page: v });
                  setManual(false);
                }}
                onKeyDown={(e) => {
                  if (e.nativeEvent.isComposing) return;
                  if (e.key === 'Tab' && e.shiftKey) {
                    e.preventDefault();
                    textRef.current?.focus();
                  } else if (e.key === 'Enter') {
                    e.preventDefault();
                    commit();
                  }
                }}
                inputMode="numeric"
                aria-label="Page"
                className="w-[4.5ch] bg-transparent py-1 text-[16px] text-faint tabular-nums outline-none focus:text-ink md:text-[13px]"
              />
            </label>
          )}
          <StatusDot inline />
          <button
            type="button"
            onPointerDown={(e) => e.preventDefault()}
            onClick={commit}
            disabled={!canSave}
            className={`shrink-0 py-1.5 ${canSave ? 'text-ink' : 'text-faint'}`}
          >
            save
          </button>
        </div>
      </div>

      {book && (
        <SectionPicker
          open={picker}
          onClose={() => setPicker(false)}
          sections={sections}
          current={validCtx}
          onPick={(id) => {
            setManual(true);
            pickCtx(id);
          }}
          onAdd={(next) => updateBook(uid, book.id, { sections: next })}
        />
      )}
    </div>
  );
});

export default Composer;
