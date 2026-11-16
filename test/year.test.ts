import assert from 'node:assert/strict';
import { test } from 'node:test';

import { yearStats, yearsWithData } from '@/lib/year';
import type { BookRow, QuoteRow } from '@/types/legi';

const at = (iso: string) => Date.parse(`${iso}T12:00:00+07:00`);

function book(id: string, over: Partial<BookRow> = {}): BookRow {
  return {
    id, title: id, author: '', status: 'finished', format: 'paper', totalPages: 200, currentPage: null,
    pdfUrl: null, takeaway: null, sections: [], startedAt: 0, finishedAt: at('2026-03-01'), lastOpenedAt: 0,
    deletedAt: null, createdAt: 0, updatedAt: 0, ...over,
  };
}

function quote(id: string, bookId: string | null, created: string, over: Partial<QuoteRow> = {}): QuoteRow {
  return {
    id, bookId, sectionId: null, kind: 'quote', text: id, note: '', page: null, favorite: false, source: 'typed',
    answeredBy: null, shownCount: 0, lastShownAt: null, trashedWithBook: false, deletedAt: null,
    createdAt: at(created), updatedAt: at(created), ...over,
  };
}

const books = [
  book('a'),
  book('b', { finishedAt: at('2026-09-01'), totalPages: null }),
  book('c', { finishedAt: at('2025-12-30') }),
  book('d', { status: 'reading', finishedAt: null }),
  book('e', { deletedAt: 1 }),
];
const quotes = [
  quote('q1', 'a', '2026-02-01'),
  quote('q2', 'd', '2026-10-01'),
  quote('q3', 'd', '2026-10-02'),
  quote('q4', 'd', '2026-10-03', { kind: 'thought' }),
  quote('q5', 'a', '2025-12-01'),
  quote('q6', 'b', '2026-05-01', { kind: 'question' }),
  quote('q7', 'a', '2026-04-01', { deletedAt: 1 }),
];

test('yearStats: finished books of the year, newest first, with their quotes', () => {
  const s = yearStats(books, quotes, 2026);
  assert.deepEqual(s.finished.map((f) => [f.book.id, f.quotes]), [['b', 1], ['a', 2]]);
  assert.equal(s.pages, 200);
});

test('yearStats: saved that year by kind, and the top book of the year', () => {
  const s = yearStats(books, quotes, 2026);
  assert.equal(s.quotes, 3);
  assert.equal(s.thoughts, 1);
  assert.equal(s.questions, 1);
  assert.equal(s.top?.book.id, 'd');
  assert.equal(s.top?.quotes, 3);
});

test('yearStats: an empty year', () => {
  const s = yearStats(books, quotes, 2024);
  assert.equal(s.finished.length, 0);
  assert.equal(s.top, null);
});

test('yearsWithData: newest first, includes this year', () => {
  assert.deepEqual(yearsWithData(books, quotes, at('2027-01-05')), [2027, 2026, 2025]);
});
