import assert from 'node:assert/strict';
import { test } from 'node:test';

import { onThisDay, pickAnother, pickDaily, revisitBoost } from '@/lib/daily';
import { addDays, dayOf } from '@/lib/day';
import { dice, findSimilar, indexText, trigrams } from '@/lib/dup';
import { bookToMarkdown, toJson, toMarkdown } from '@/lib/export';
import { compareQuotes, orderBetween, orderForStep, sortQuotes } from '@/lib/order';
import { mergeFields, splitText } from '@/lib/quote-ops';
import { markRanges, searchAll } from '@/lib/search';
import { isSource } from '@/lib/source';
import { spineShade, stackSize } from '@/lib/spine';
import { daysLeft, purgeable, TRASH_MS, trashedWith } from '@/lib/trash';
import { lastUndoStore, pushUndo, resetUndo, undo, undoSize } from '@/lib/undo';
import type { BookRow, QuoteRow } from '@/types/legi';

const DAY = 86_400_000;
const NOW = new Date(2026, 9, 13, 12).getTime();

function book(over: Partial<BookRow> = {}): BookRow {
  return {
    id: 'b1',
    title: 'Sách',
    author: '',
    status: 'reading',
    format: 'paper',
    totalPages: null,
    currentPage: null,
    pdfUrl: null,
    takeaway: null,
    sections: [],
    startedAt: 0,
    finishedAt: null,
    lastOpenedAt: 0,
    deletedAt: null,
    createdAt: 0,
    updatedAt: 0,
    ...over,
  };
}

function quote(id: string, over: Partial<QuoteRow> = {}): QuoteRow {
  return {
    id,
    bookId: 'b1',
    sectionId: null,
    kind: 'quote',
    text: `Câu ${id}`,
    note: '',
    page: null,
    favorite: false,
    source: 'typed',
    answeredBy: null,
    shownCount: 0,
    lastShownAt: null,
    trashedWithBook: false,
    deletedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...over,
  };
}

test('order: page first (none last), then time', () => {
  const qs = [quote('c', { page: null, createdAt: 1 }), quote('b', { page: 9, createdAt: 5 }), quote('a', { page: 9, createdAt: 2 }), quote('d', { page: 3 })];
  assert.deepEqual(sortQuotes(qs).map((q) => q.id), ['d', 'a', 'b', 'c']);
  assert.equal(compareQuotes({ page: 1, createdAt: 0 }, { page: 1, createdAt: 0 }), 0);
  assert.equal(orderBetween(null, null), 1);
  assert.equal(orderBetween(2, null), 3);
  assert.equal(orderBetween(null, 2), 1);
  assert.equal(orderBetween(1, 2), 1.5);
});

test('order: a set order wins over time, still after page', () => {
  const qs = [quote('a', { page: 5, createdAt: 1 }), quote('b', { page: 5, createdAt: 2 }), quote('c', { page: 5, createdAt: 3, order: 0.5 }), quote('d', { page: 2, createdAt: 9, order: 99 })];
  assert.deepEqual(sortQuotes(qs).map((q) => q.id), ['d', 'c', 'a', 'b']);
});

test('order: move up/down passes one neighbor of the same page', () => {
  const list = sortQuotes([
    quote('a', { page: 5, createdAt: 10 }),
    quote('b', { page: 5, createdAt: 20 }),
    quote('c', { page: 5, createdAt: 30 }),
    quote('d', { page: 6, createdAt: 40 }),
  ]);
  const moved = (id: string, dir: -1 | 1) => {
    const order = orderForStep(list, id, dir);
    assert.notEqual(order, null);
    return sortQuotes(list.map((q) => (q.id === id ? { ...q, order: order as number } : q))).map((q) => q.id);
  };
  assert.deepEqual(moved('c', -1), ['a', 'c', 'b', 'd']);
  assert.deepEqual(moved('b', -1), ['b', 'a', 'c', 'd']);
  assert.deepEqual(moved('a', 1), ['b', 'a', 'c', 'd']);
  assert.deepEqual(moved('b', 1), ['a', 'c', 'b', 'd']);
  // No neighbor, or the neighbor is on another page / section.
  assert.equal(orderForStep(list, 'a', -1), null);
  assert.equal(orderForStep(list, 'c', 1), null);
  assert.equal(orderForStep(list, 'd', -1), null);
  const other = list.map((q) => (q.id === 'b' ? { ...q, sectionId: 'x' } : q));
  assert.equal(orderForStep(other, 'c', -1), null);
});

test('trash: days left, purgeable, trashed with book', () => {
  assert.equal(daysLeft(NOW, NOW), 30);
  assert.equal(daysLeft(NOW - 29.5 * DAY, NOW), 1);
  assert.equal(daysLeft(NOW - 40 * DAY, NOW), 0);
  const items = [
    { id: 'old', deletedAt: NOW - TRASH_MS - 2 * 60_000 },
    { id: 'new', deletedAt: NOW - DAY },
    { id: 'live', deletedAt: null },
  ];
  assert.deepEqual(purgeable(items, NOW).map((x) => x.id), ['old']);
  const qs = [quote('1', { trashedWithBook: true, deletedAt: 5 }), quote('2', { trashedWithBook: false, deletedAt: 5 }), quote('3', { trashedWithBook: true, deletedAt: 6 })];
  assert.deepEqual(trashedWith(qs, 'b1', 5).map((q) => q.id), ['1']);
});

test('merge and split', () => {
  const m = mergeFields([
    { text: 'Một,', note: 'n1', page: 12, favorite: false },
    { text: ' hai.', note: '', page: 11, favorite: true },
  ]);
  assert.deepEqual(m, { text: 'Một, hai.', note: 'n1', page: 11, favorite: true });
  assert.deepEqual(splitText('Một, hai.', 4), ['Một,', 'hai.']);
  assert.equal(splitText('Một', 0), null);
  assert.equal(splitText('Một', 3), null);
});

test('undo stack reverts newest first and caps at 20', () => {
  resetUndo();
  const log: number[] = [];
  for (let i = 0; i < 25; i++) pushUndo('x', () => log.push(i));
  assert.equal(undoSize(), 20);
  assert.equal(lastUndoStore.get()?.label, 'x');
  assert.equal(undo(), true);
  assert.deepEqual(log, [24]);
  assert.equal(lastUndoStore.get(), null);
  resetUndo();
  assert.equal(undo(), false);
});

test('dup: dice, near copies, containment, marks matter', () => {
  assert.equal(dice(trigrams('abc'), trigrams('abc')), 1);
  const index = [
    indexText('a', 'Bạn không vươn lên bằng mục tiêu, bạn rơi xuống bằng hệ thống của mình.'),
    indexText('b', 'Một câu hoàn toàn khác về chuyện đọc sách mỗi ngày.'),
  ];
  assert.equal(findSimilar('Bạn không vươn lên bằng mục tiêu, bạn rơi xuống bằng hệ thống của bạn.', index)?.id, 'a');
  assert.equal(findSimilar('bạn rơi xuống bằng hệ thống của mình', index)?.id, 'a');
  assert.equal(findSimilar('ngắn quá', index), null);
  assert.equal(findSimilar('Bạn không vươn lên bằng mục tiêu, bạn rơi xuống bằng hệ thống của mình.', index, 'a'), null);
  const marks = [indexText('m', 'má mà mả mã mạ ma má mà mả mã mạ')];
  assert.equal(findSimilar('ma ma ma ma ma ma ma ma ma ma ma', marks), null);
});

test('daily another: skips seen quotes, least shown first, null when all seen', () => {
  const books = new Map([['b1', book()]]);
  const qs = ['a', 'b', 'c'].map((id) => quote(id));
  const day = '2026-10-13';
  for (const r of [0, 0.5, 0.99]) assert.notEqual(pickAnother(qs, books, day, new Set(['a']), r)?.id, 'a');
  const shown = qs.map((q) => (q.id === 'b' ? { ...q, shownCount: 1 } : q));
  assert.equal(pickAnother(shown, books, day, new Set(['a']), 0.99)?.id, 'c');
  assert.equal(pickAnother(qs, books, day, new Set(['a', 'b', 'c']), 0.5), null);
});

test('daily: same day same pick, least shown first, favorites weigh more', () => {
  const books = new Map([['b1', book()]]);
  const qs = ['a', 'b', 'c', 'd'].map((id) => quote(id));
  const day = '2026-10-13';
  assert.equal(pickDaily(qs, books, day)?.id, pickDaily([...qs].reverse(), books, day)?.id);
  const shown = qs.map((q) => (q.id === 'c' ? q : { ...q, shownCount: 1 }));
  assert.equal(pickDaily(shown, books, day)?.id, 'c');
  assert.equal(pickDaily([quote('t', { kind: 'thought' })], books, day)?.id, 't');
  assert.equal(pickDaily([quote('q', { kind: 'question' })], books, day), null);
  assert.equal(pickDaily([quote('x', { deletedAt: 1 })], books, day), null);

  const fav = [quote('f', { favorite: true }), quote('n')];
  let favWins = 0;
  for (let i = 0; i < 1000; i++) if (pickDaily(fav, books, addDays('2026-01-01', i))?.id === 'f') favWins++;
  assert.ok(favWins > 650 && favWins < 850, `favorite won ${favWins} of 1000`);
});

test('daily: revisit windows', () => {
  const day = '2026-10-13';
  const finished = (daysAgo: number) => book({ status: 'finished', finishedAt: new Date(2026, 9, 13 - daysAgo, 12).getTime() });
  const fav = quote('f', { favorite: true });
  assert.equal(revisitBoost(finished(7), fav, day), 4);
  assert.equal(revisitBoost(finished(30), fav, day), 4);
  assert.equal(revisitBoost(finished(90), fav, day), 4);
  assert.equal(revisitBoost(finished(15), fav, day), 1);
  assert.equal(revisitBoost(finished(7), quote('n'), day), 1);
  assert.equal(revisitBoost(book(), fav, day), 1);
});

test('onThisDay: same month-day, earlier years, newest first', () => {
  const at = (y: number) => new Date(y, 9, 13, 12).getTime();
  const qs = [quote('2024', { createdAt: at(2024) }), quote('2025', { createdAt: at(2025) }), quote('now', { createdAt: at(2026) }), quote('other', { createdAt: new Date(2025, 9, 14, 12).getTime() })];
  assert.equal(onThisDay(qs, '2026-10-13')?.id, '2025');
  assert.equal(onThisDay(qs, '2026-10-20'), null);
  assert.equal(dayOf(at(2025)), '2025-10-13');
});

test('search: no marks, every word, đ, ranges on original text', () => {
  const books = [book({ title: 'Đường xưa mây trắng' })];
  const qs = [quote('1', { text: 'Thói quen là lãi kép' }), quote('2', { text: 'Đường dài mới biết ngựa hay', note: 'thói quen' }), quote('3', { text: 'Không liên quan' })];
  const r = searchAll('thoi quen', books, qs);
  assert.deepEqual(r.groups[0].hits.map((h) => h.quote.id), ['1', '2']);
  assert.deepEqual(searchAll('duong', books, qs).books.map((b) => b.title), ['Đường xưa mây trắng']);
  assert.deepEqual(searchAll('duong ngua', books, qs).groups[0].hits.map((h) => h.quote.id), ['2']);
  assert.deepEqual(markRanges('Thói quen là', ['thoi']), [[0, 4]]);
  assert.deepEqual(searchAll('  ', books, qs).groups, []);
});

test('export: markdown with sections, notes, thoughts; json skips trash', () => {
  const b = book({
    title: 'Atomic Habits',
    author: 'James Clear',
    takeaway: 'Hệ thống hơn mục tiêu.',
    sections: [
      { id: 's1', title: 'Chương 1', parentId: null, order: 1 },
      { id: 's2', title: '1.1 Mục', parentId: 's1', order: 1 },
    ],
  });
  const qs = [
    quote('a', { sectionId: 's2', text: 'Câu hay', page: 12, note: 'ghi chú' }),
    quote('b', { sectionId: 's1', kind: 'thought', text: 'Suy nghĩ' }),
    quote('c', { sectionId: null, text: 'Đầu sách' }),
    quote('x', { deletedAt: 1, text: 'Đã xoá' }),
  ];
  assert.equal(
    bookToMarkdown(b, qs),
    '# Atomic Habits\n\nJames Clear\n\n> What stays with you: Hệ thống hơn mục tiêu.\n\nĐầu sách\n\n## Chương 1\n\nThought: Suy nghĩ\n\n### 1.1 Mục\n\nCâu hay (p. 12)\n\nNote: ghi chú\n',
  );
  const inbox = quote('i', { bookId: null, text: 'Trong inbox' });
  assert.ok(toMarkdown([b], [...qs, inbox]).includes('# Inbox\n\nTrong inbox'));
  const json = JSON.parse(toJson([b, book({ id: 'gone', deletedAt: 1 })], qs, 5));
  assert.equal(json.app, 'legi');
  assert.equal(json.books.length, 1);
  assert.equal(json.quotes.length, 3);
});

test('cover shade is stable and in range', () => {
  assert.equal(spineShade('b1'), spineShade('b1'));
  for (const id of ['a', 'b', 'c', 'seed-habits']) assert.ok([1, 2, 3, 4].includes(spineShade(id)));
});

test('pile sizes stay in bounds', () => {
  for (const [n, p] of [[0, null], [10_000, 5000], [5, 0]] as const) {
    const s = stackSize('x', n, p);
    assert.ok(s.height >= 28 && s.height <= 48);
    assert.ok(s.width >= 68 && s.width <= 92);
    assert.ok(s.shift >= 0 && s.width + s.shift <= 100);
  }
});

test('isSource: video, web and person are sources, paper and pdf are books', () => {
  assert.deepEqual(
    (['paper', 'pdf', 'video', 'web', 'person'] as const).map((format) => isSource({ format })),
    [false, false, true, true, true],
  );
});
