import assert from 'node:assert/strict';
import { test } from 'node:test';

import { addDays } from '@/lib/day';
import { PAGE_LOG_MAX, finishDay, logPage, pagesPerDay } from '@/lib/pace';

test('logPage keeps one mark per day, sorted, capped', () => {
  let log = logPage(undefined, '2026-11-10', 20);
  log = logPage(log, '2026-11-10', 35);
  log = logPage(log, '2026-11-08', 10);
  assert.deepEqual(log, [
    { d: '2026-11-08', p: 10 },
    { d: '2026-11-10', p: 35 },
  ]);
  let long: ReturnType<typeof logPage> = [];
  for (let i = 0; i < 40; i++) long = logPage(long, addDays('2026-10-01', i), i + 1);
  assert.equal(long.length, PAGE_LOG_MAX);
  assert.equal(long[long.length - 1].p, 40);
});

test('pagesPerDay needs two marks two days apart and a gain', () => {
  assert.equal(pagesPerDay(undefined, '2026-11-16'), null);
  assert.equal(pagesPerDay([{ d: '2026-11-16', p: 50 }], '2026-11-16'), null);
  assert.equal(pagesPerDay([{ d: '2026-11-15', p: 40 }, { d: '2026-11-16', p: 50 }], '2026-11-16'), null);
  assert.equal(pagesPerDay([{ d: '2026-11-10', p: 50 }, { d: '2026-11-16', p: 50 }], '2026-11-16'), null);
});

test('pagesPerDay counts days up to today, so a pause slows it', () => {
  const log = [
    { d: '2026-11-06', p: 100 },
    { d: '2026-11-11', p: 200 },
  ];
  assert.equal(pagesPerDay(log, '2026-11-11'), 20);
  assert.equal(pagesPerDay(log, '2026-11-16'), 10);
});

test('pagesPerDay starts from the last mark before the 14-day window', () => {
  const log = [
    { d: '2026-10-01', p: 10 },
    { d: '2026-10-30', p: 100 },
    { d: '2026-11-16', p: 300 },
  ];
  // Baseline is Oct 30 (the last before Nov 2): 200 pages in 17 days.
  assert.equal(pagesPerDay(log, '2026-11-16'), 200 / 17);
});

test('finishDay adds the days left at the current pace', () => {
  const log = [
    { d: '2026-11-06', p: 100 },
    { d: '2026-11-16', p: 200 },
  ];
  assert.equal(finishDay(log, 200, 300, '2026-11-16'), '2026-11-26');
  assert.equal(finishDay(log, 200, null, '2026-11-16'), null);
  assert.equal(finishDay(log, 300, 300, '2026-11-16'), null);
});

test('finishDay gives up when it is over a year away', () => {
  const log = [
    { d: '2026-11-02', p: 1 },
    { d: '2026-11-16', p: 2 },
  ];
  assert.equal(finishDay(log, 2, 5000, '2026-11-16'), null);
});
