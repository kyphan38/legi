'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';

import TopBar from '@/components/TopBar';
import { useLibrary } from '@/contexts/LibraryContext';
import { dayOf } from '@/lib/day';
import { yearStats, yearsWithData } from '@/lib/year';

/** /year/?y=2026 - one year of reading. No ?y = this year. */
export default function YearView() {
  const params = useSearchParams();
  const { liveBooks, quotes, loaded } = useLibrary();
  // Read once: the page does not need to follow midnight.
  const [now] = useState(() => Date.now());
  const thisYear = Number(dayOf(now).slice(0, 4));
  const asked = Number(params.get('y'));
  const year = Number.isInteger(asked) && asked > 1900 ? asked : thisYear;

  const allQuotes = useMemo(() => [...quotes.values()], [quotes]);
  const years = useMemo(() => yearsWithData(liveBooks, allQuotes, now), [liveBooks, allQuotes, now]);
  const s = useMemo(() => yearStats(liveBooks, allQuotes, year), [liveBooks, allQuotes, year]);
  const saved = s.quotes + s.thoughts + s.questions;

  return (
    <main className="paper pb-24">
      <TopBar current={null} />

      <div className="mt-8 flex items-baseline gap-4">
        <h1 className="text-[15px] font-medium text-ink">{year}</h1>
        {years.length > 1 && (
          <nav className="ml-auto flex gap-3 text-[13px] text-faint" aria-label="Year">
            {years.map((y) => (
              <Link key={y} href={y === thisYear ? '/year/' : `/year/?y=${y}`} replace className={y === year ? 'text-ink' : 'hover:text-ink'}>
                {y}
              </Link>
            ))}
          </nav>
        )}
      </div>

      {loaded && (
        <>
          <dl className="mt-8 grid grid-cols-2 gap-y-5 text-[15px] sm:grid-cols-3">
            <Stat label="books finished" value={s.finished.length} />
            <Stat label="pages" value={s.pages} />
            <Stat label="saved" value={saved} />
          </dl>
          {saved > 0 && (
            <p className="mt-3 text-[13px] text-faint">
              {[`${s.quotes} quotes`, s.thoughts ? `${s.thoughts} thoughts` : '', s.questions ? `${s.questions} questions` : ''].filter(Boolean).join(' · ')}
            </p>
          )}

          {s.top && (
            <section className="mt-10">
              <h2 className="text-[13px] text-faint">most quoted</h2>
              <Link href={`/book/?id=${s.top.book.id}`} className="mt-2 block text-[15px] text-ink hover:text-muted">
                {s.top.book.title} <span className="text-faint">· {s.top.quotes}</span>
              </Link>
            </section>
          )}

          <section className="mt-10">
            <h2 className="text-[13px] text-faint">finished</h2>
            {s.finished.length === 0 ? (
              <p className="mt-2 text-[14px] text-faint">None yet.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {s.finished.map(({ book, quotes: n }) => (
                  <li key={book.id}>
                    <Link href={`/book/?id=${book.id}`} className="flex items-baseline gap-3 text-[15px] text-ink hover:text-muted">
                      <span className="min-w-0 flex-1 truncate">{book.title}</span>
                      <span className="shrink-0 text-[13px] text-faint tabular-nums">
                        {n} {n === 1 ? 'quote' : 'quotes'}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-[13px] text-faint">{label}</dt>
      <dd className="mt-1 text-[22px] text-ink tabular-nums">{value.toLocaleString('en-US')}</dd>
    </div>
  );
}
