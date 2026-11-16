import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readAgain } from '@/lib/revisit';
import type { BookRow } from '@/types/legi';

const DAY = 86_400_000;
const NOW = Date.parse('2026-11-16T12:00:00+07:00');

function book(id: string, over: Partial<BookRow> = {}): BookRow {
  return {
    id,
    title: id,
    author: '',
    status: 'finished',
    format: 'paper',
    totalPages: null,
    currentPage: null,
    pdfUrl: null,
    takeaway: null,
    sections: [],
    startedAt: 0,
    finishedAt: NOW - 200 * DAY,
    lastOpenedAt: 0,
    deletedAt: null,
    createdAt: 0,
    updatedAt: 0,
    ...over,
  };
}

const counts: Record<string, number> = { old: 40, few: 3, recent: 50, reading: 60, gone: 70 };
const count = (id: string) => counts[id] ?? 0;

test('readAgain picks only old finished books with many quotes', () => {
  const books = [
    book('old'),
    book('few'),
    book('recent', { finishedAt: NOW - 30 * DAY }),
    book('reading', { status: 'reading', finishedAt: null }),
    book('gone', { deletedAt: NOW }),
  ];
  const pick = readAgain(books, count, '2026-11-16');
  assert.equal(pick?.book.id, 'old');
  assert.equal(pick?.count, 40);
});

test('readAgain gives nothing when no book fits', () => {
  assert.equal(readAgain([book('few')], count, '2026-11-16'), null);
});

test('readAgain is stable within a day and can change across days', () => {
  const books = ['a', 'b', 'c', 'd', 'e'].map((id) => book(id));
  const many = () => 20;
  const today = readAgain(books, many, '2026-11-16')?.book.id;
  assert.equal(readAgain(books, many, '2026-11-16')?.book.id, today);
  const week = new Set(['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20'].map((d) => readAgain(books, many, d)?.book.id));
  assert.ok(week.size > 1);
});
