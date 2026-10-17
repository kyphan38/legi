'use client';

// ============================================================
// legi - "/" decides where to go
//
// First open of the day (day starts 04:00): the Daily quote.
// Otherwise: the last book with the cursor ready, or the shelf.
// ?new=1 (app shortcut, iOS Shortcut): straight to the composer.
// ?daily=1 (top bar, ⌘K): today's Daily again, same quote.
// ============================================================

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';

import { useUid } from '@/components/AuthGate';
import { LAST_BOOK_KEY } from '@/components/BookView';
import Typewriter from '@/components/Typewriter';
import { useLibrary } from '@/contexts/LibraryContext';
import { mulberry32, onThisDay, pickAnother, pickDaily } from '@/lib/daily';
import { dayOf } from '@/lib/day';
import { getDb } from '@/lib/firebase-client';
import { pathOf } from '@/lib/outline';
import { markShown, saveDaily } from '@/lib/repo';
import { readJson, writeJson } from '@/lib/store';
import type { DailyPick, QuoteRow } from '@/types/legi';

const SEEN_KEY = 'legi.dailySeen';
const SERVER_WAIT_MS = 1500;

function quoteHref(q: QuoteRow): string {
  return q.bookId ? `/book/?id=${q.bookId}&q=${q.id}` : `/inbox/?q=${q.id}`;
}

export default function HomeView() {
  const router = useRouter();
  const params = useSearchParams();
  const { books, liveBooks, liveQuotes, loaded } = useLibrary();
  const startNew = params.get('new') === '1';
  const again = params.get('daily') === '1';
  const [today] = useState(() => dayOf(Date.now()));
  const [showDaily] = useState(() => again || (!startNew && readJson<string>(SEEN_KEY) !== today));

  const target = useMemo(() => {
    const last = readJson<string>(LAST_BOOK_KEY);
    const book = (last && books.get(last)?.deletedAt === null ? books.get(last) : null) ?? [...liveBooks].sort((a, b) => b.lastOpenedAt - a.lastOpenedAt)[0];
    return book ? `/book/?id=${book.id}${startNew ? '&new=1' : ''}` : '/shelf/';
  }, [books, liveBooks, startNew]);

  const hasQuotes = liveQuotes.some((q) => q.kind !== 'question');

  useEffect(() => {
    if (!loaded) return;
    if (!showDaily || !hasQuotes) router.replace(target);
  }, [loaded, showDaily, hasQuotes, target, router]);

  if (!loaded || !showDaily || !hasQuotes) return <main className="min-h-dvh" />;
  return <Daily day={today} continueTo={target} />;
}

function Daily({ day, continueTo }: { day: string; continueTo: string }) {
  const uid = useUid();
  const router = useRouter();
  const { books, quotes, liveQuotes } = useLibrary();
  // The day's pick first, then each "another". The last one is on screen.
  const [shown, setShown] = useState<string[]>([]);
  const decided = useRef(false);
  // After "another", a late snapshot of the day's pick must not switch back.
  const browsing = useRef(false);
  const [seed] = useState(() => Math.floor(Math.random() * 2 ** 32));

  // Use the day's pick if any device made one; otherwise make it here.
  useEffect(() => {
    const ref = doc(getDb(), 'users', uid, 'daily', day);
    let timer: ReturnType<typeof setTimeout> | null = null;
    const decide = (existing: DailyPick | null) => {
      if (existing) {
        if (browsing.current) return;
        setShown([existing.quoteId]);
        decided.current = true;
        return;
      }
      if (decided.current) return;
      decided.current = true;
      const pick = pickDaily(liveQuotes, books, day);
      if (!pick) return;
      setShown([pick.id]);
      saveDaily(uid, day, pick);
    };
    const off = onSnapshot(
      ref,
      { includeMetadataChanges: true },
      (snap) => {
        const data = snap.exists() ? (snap.data() as DailyPick) : null;
        if (data || !snap.metadata.fromCache || !navigator.onLine) {
          if (timer) clearTimeout(timer);
          decide(data);
        } else if (!timer) {
          timer = setTimeout(() => decide(null), SERVER_WAIT_MS);
        }
      },
      () => decide(null),
    );
    writeJson(SEEN_KEY, day);
    return () => {
      off();
      if (timer) clearTimeout(timer);
    };
    // Picks once per mount: later library changes must not change the quote.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, day]);

  const quoteId = shown.at(-1);
  const quote = quoteId ? quotes.get(quoteId) : undefined;
  const past = useMemo(() => onThisDay(liveQuotes, day), [liveQuotes, day]);
  const next = useMemo(
    () => (shown.length > 0 ? pickAnother(liveQuotes, books, day, new Set(shown), mulberry32(seed + shown.length)()) : null),
    [shown, liveQuotes, books, day, seed],
  );

  const another = () => {
    if (!next) return;
    browsing.current = true;
    setShown((ids) => [...ids, next.id]);
    markShown(uid, next);
  };

  // Any letter key: continue to the book and type.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.key.length !== 1) return;
      router.replace(continueTo.startsWith('/book/') ? `${continueTo}${continueTo.includes('new=1') ? '' : '&new=1'}` : continueTo);
    };
    const t = setTimeout(() => window.addEventListener('keydown', onKey), 300);
    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', onKey);
    };
  }, [continueTo, router]);

  if (!quote) return <main className="min-h-dvh" />;
  const book = quote.bookId ? books.get(quote.bookId) : null;
  const where = [book?.title ?? 'Inbox', ...(book ? pathOf(book.sections, quote.sectionId).map((s) => s.title) : [])].join(' · ');
  const pastBook = past?.bookId ? books.get(past.bookId) : null;

  return (
    <main className="paper flex min-h-dvh flex-col justify-center pb-[10dvh]">
      <div className="fade-in">
        <p className="text-[calc(var(--quote-size)+2px)] leading-[1.75] whitespace-pre-wrap text-ink">
          <Typewriter key={quote.id} text={quote.text} />
        </p>
        <p className="mt-6 text-[13px] text-faint">
          {where}
          {quote.page !== null && <span className="whitespace-nowrap"> · p. {quote.page}</span>}
        </p>
        <div className="mt-10 flex gap-6 text-[14px]">
          <Link href={quoteHref(quote)} className="text-ink">
            open in book
          </Link>
          {next && (
            <button type="button" onClick={another} className="text-faint hover:text-ink">
              another
            </button>
          )}
          <Link href={continueTo} replace className="text-faint hover:text-ink">
            continue
          </Link>
        </div>
        {shown.length === 1 && past && past.id !== quote.id && (
          <Link href={quoteHref(past)} className="mt-14 block text-[13px] leading-relaxed text-faint hover:text-muted">
            <span className="text-muted">
              {dayOf(past.createdAt).slice(0, 4)} · {pastBook?.title ?? 'Inbox'}
            </span>
            <span className="mt-1 block">{truncate(past.text.replace(/\*\*/g, ''), 80)}</span>
          </Link>
        )}
      </div>
    </main>
  );
}

function truncate(s: string, n: number): string {
  const chars = Array.from(s);
  return chars.length <= n ? s : chars.slice(0, n).join('').trimEnd() + '…';
}
