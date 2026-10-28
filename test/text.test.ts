import assert from 'node:assert/strict';
import { test } from 'node:test';

import { toggleEmph, parseEmph } from '@/lib/emph';
import { pagesPerBlock, takePageToken } from '@/lib/page-token';
import { cleanPaste, countBlocks, dropSeparators, splitBlocks } from '@/lib/paste';
import { tidy } from '@/lib/typo';

test('tidy: ellipsis, curly quotes, apostrophes, spaces', () => {
  assert.equal(tidy('  Anh ấy nói "đi thôi"...  '), 'Anh ấy nói “đi thôi”…');
  assert.equal(tidy("It's fine"), 'It’s fine');
  assert.equal(tidy('một   hai\n\n\n'), 'một hai');
  assert.equal(tidy('\n\nxin chào'), 'xin chào');
});

test('tidy turns ascii arrows into arrows', () => {
  assert.equal(tidy('xe hơi -> Detroit, <- quay lại, a <-> b, nếu => thì'), 'xe hơi → Detroit, ← quay lại, a ↔ b, nếu ⇒ thì');
});

test('tidy never capitalizes and keeps inner line breaks', () => {
  assert.equal(tidy('dòng một\ndòng hai'), 'dòng một\ndòng hai');
});

test('tidy composes NFD input', () => {
  assert.equal(tidy('Ngu\u031bo\u031b\u0300i'), 'Người');
});

test('takePageToken reads only a trailing token', () => {
  assert.deepEqual(takePageToken('Câu hay p52'), { text: 'Câu hay', page: 52 });
  assert.deepEqual(takePageToken('Câu hay p.52'), { text: 'Câu hay', page: 52 });
  assert.deepEqual(takePageToken('Câu hay tr.12'), { text: 'Câu hay', page: 12 });
  assert.deepEqual(takePageToken('Câu hay P 7 '), { text: 'Câu hay', page: 7 });
  assert.deepEqual(takePageToken('help52'), { text: 'help52', page: null });
  assert.deepEqual(takePageToken('Câu p0'), { text: 'Câu p0', page: null });
  assert.deepEqual(takePageToken('p52 ở đầu câu'), { text: 'p52 ở đầu câu', page: null });
});

test('pagesPerBlock: each quote keeps its own page, others follow the one before', () => {
  const { blocks, pages } = pagesPerBlock(splitBlocks('# Ch 1\n\nMột p12\n\nHai\n\nBa tr.15'), 10);
  assert.deepEqual(pages, [null, 12, 12, 15]);
  assert.deepEqual(
    blocks.map((b) => (b.type === 'quote' ? b.text : b.title)),
    ['Ch 1', 'Một', 'Hai', 'Ba'],
  );
  assert.deepEqual(pagesPerBlock(splitBlocks('Một\n\nHai'), 7).pages, [7, 7]);
  assert.deepEqual(pagesPerBlock(splitBlocks('Một\n\nHai'), null).pages, [null, null]);
});

test('splitBlocks: blank line = new quote, single line break stays', () => {
  const blocks = splitBlocks('Một\nhai\n\nBa');
  assert.deepEqual(blocks, [
    { type: 'quote', text: 'Một\nhai' },
    { type: 'quote', text: 'Ba' },
  ]);
});

test('splitBlocks: a --- line makes only --- split, blank lines stay inside', () => {
  const blocks = splitBlocks('Một\n\n\nhai\n---\nBa\n\n***\n\n# Chương\nBốn');
  assert.deepEqual(blocks, [
    { type: 'quote', text: 'Một\n\nhai' },
    { type: 'quote', text: 'Ba' },
    { type: 'heading', depth: 1, title: 'Chương' },
    { type: 'quote', text: 'Bốn' },
  ]);
  const long = String.fromCharCode(0x2014);
  assert.equal(splitBlocks(`A\n\nB\n${long}-\nC`).length, 2);
  assert.equal(splitBlocks('A\n- một\nB').length, 1);
});

test('dropSeparators keeps the paragraphs', () => {
  assert.equal(dropSeparators('A\n\n---\n\nB\n---'), 'A\n\nB');
});

test('splitBlocks: # headings', () => {
  const blocks = splitBlocks('# Chương 1\nCâu một\n\n## 1.1 Mục\n\nCâu hai');
  assert.deepEqual(countBlocks(blocks), { quotes: 2, headings: 2 });
  assert.deepEqual(blocks[0], { type: 'heading', depth: 1, title: 'Chương 1' });
  assert.deepEqual(blocks[2], { type: 'heading', depth: 2, title: '1.1 Mục' });
});

test('cleanPaste joins hard-wrapped PDF lines and hyphenated words', () => {
  const raw = 'Bạn không vươn lên bằng mục tiêu, bạn rơi\nxuống bằng hệ thống. Đây là infor-\nmation.\n\n54\n\nCâu thứ hai.';
  assert.equal(cleanPaste(raw), 'Bạn không vươn lên bằng mục tiêu, bạn rơi xuống bằng hệ thống. Đây là information.\n\nCâu thứ hai.');
});

test('cleanPaste keeps a break after a sentence before a capital or bullet', () => {
  assert.equal(cleanPaste('Một câu.\nHai câu.'), 'Một câu.\nHai câu.');
  assert.equal(cleanPaste('Danh sách:\n- một\n- hai'), 'Danh sách:\n- một - hai');
  assert.equal(cleanPaste('# Chương\nCâu'), '# Chương\nCâu');
});

test('cleanPaste puts a separator on its own paragraph', () => {
  assert.equal(cleanPaste('Một câu\n---\nhai câu'), 'Một câu\n\n---\n\nhai câu');
  assert.equal(cleanPaste('Đoạn một.\n\nĐoạn hai.\n\n* * *\n\nQuote khác.'), 'Đoạn một.\n\nĐoạn hai.\n\n---\n\nQuote khác.');
});

test('cleanPaste drops page-number lines and soft hyphens', () => {
  assert.equal(cleanPaste('Câu\u00ad một\n- 12 -\ntiếp'), 'Câu một tiếp');
});

test('emphasis parse and toggle', () => {
  assert.deepEqual(parseEmph('a **b** c'), [
    { text: 'a ', strong: false },
    { text: 'b', strong: true },
    { text: ' c', strong: false },
  ]);
  const on = toggleEmph('một hai ba', 4, 8);
  assert.equal(on.text, 'một **hai** ba');
  const off = toggleEmph(on.text, on.start, on.end);
  assert.equal(off.text, 'một hai ba');
  assert.equal(toggleEmph('x', 0, 0).text, 'x');
});
