import assert from 'node:assert/strict';
import { test } from 'node:test';

import { addSection, addSectionAfter, buildTree, flatten, indent, moveDown, moveUp, outdent, misplacedByPage, parseToc, pathOf, removeSection, sectionForPage, setStartPage, subtreeIds } from '@/lib/outline';
import type { Section } from '@/types/legi';

const S = (id: string, parentId: string | null, order: number, title = id): Section => ({ id, title, parentId, order });

const base: Section[] = [S('a', null, 1), S('a1', 'a', 1), S('a2', 'a', 2), S('b', null, 2)];

const titles = (sections: Section[]) => flatten(buildTree(sections)).map((n) => `${n.depth}:${n.section.id}`);

test('buildTree orders by order and keeps depth', () => {
  assert.deepEqual(titles(base), ['0:a', '1:a1', '1:a2', '0:b']);
});

test('buildTree puts orphans at the top level and survives cycles', () => {
  assert.deepEqual(titles([S('x', 'missing', 1)]), ['0:x']);
  const cyc = [S('p', 'q', 1), S('q', 'p', 1), S('r', null, 1)];
  assert.deepEqual(titles(cyc), ['0:r']);
});

test('pathOf and subtreeIds', () => {
  assert.deepEqual(pathOf(base, 'a2').map((s) => s.id), ['a', 'a2']);
  assert.deepEqual(pathOf(base, null), []);
  assert.deepEqual([...subtreeIds(base, 'a')].sort(), ['a', 'a1', 'a2']);
});

test('addSection appends at the end of its parent', () => {
  const { sections, id } = addSection(base, '  a3 ', 'a', 'a3');
  assert.equal(id, 'a3');
  assert.equal(sections.find((s) => s.id === 'a3')?.title, 'a3');
  assert.deepEqual(titles(sections), ['0:a', '1:a1', '1:a2', '1:a3', '0:b']);
});

test('indent / outdent', () => {
  assert.deepEqual(titles(indent(base, 'b')), ['0:a', '1:a1', '1:a2', '1:b']);
  assert.deepEqual(titles(indent(base, 'a2')), ['0:a', '1:a1', '2:a2', '0:b']);
  assert.deepEqual(titles(indent(base, 'a')), titles(base));
  assert.deepEqual(titles(outdent(base, 'a1')), ['0:a', '1:a2', '0:a1', '0:b']);
  assert.deepEqual(titles(outdent(base, 'a')), titles(base));
});

test('moveUp / moveDown swap with a sibling', () => {
  assert.deepEqual(titles(moveDown(base, 'a1')), ['0:a', '1:a2', '1:a1', '0:b']);
  assert.deepEqual(titles(moveUp(base, 'b')), ['0:b', '0:a', '1:a1', '1:a2']);
  assert.deepEqual(titles(moveUp(base, 'a')), titles(base));
});

test('removeSection moves children up', () => {
  assert.deepEqual(titles(removeSection(base, 'a')), ['0:a1', '0:a2', '0:b']);
});

test('parseToc: numbering', () => {
  const out = parseToc('1. Chương một\n1.1 Mục\n1.1.1 Ý\n\n2. Chương hai');
  const t = flatten(buildTree(out)).map((n) => `${n.depth}:${n.section.title}`);
  assert.deepEqual(t, ['0:1. Chương một', '1:1.1 Mục', '2:1.1.1 Ý', '0:2. Chương hai']);
});

test('parseToc: tabs and two spaces', () => {
  const out = parseToc('Phần A\n\tChương 1\n    Mục x\n  Chương 2\nPhần B');
  const t = flatten(buildTree(out)).map((n) => `${n.depth}:${n.section.title}`);
  assert.deepEqual(t, ['0:Phần A', '1:Chương 1', '2:Mục x', '1:Chương 2', '0:Phần B']);
});

test('parseToc appends after existing sections and clamps jumps', () => {
  const out = parseToc('    Sâu quá', base);
  const last = flatten(buildTree(out)).at(-1);
  assert.equal(last?.section.title, 'Sâu quá');
  assert.equal(last?.depth, 0);
});

test('addSectionAfter: same level, right after, before later siblings', () => {
  assert.deepEqual(titles(addSectionAfter(base, 'x', 'a1', 'x').sections), ['0:a', '1:a1', '1:x', '1:a2', '0:b']);
  assert.deepEqual(titles(addSectionAfter(base, 'x', 'a2', 'x').sections), ['0:a', '1:a1', '1:a2', '1:x', '0:b']);
  assert.deepEqual(titles(addSectionAfter(base, 'x', 'a', 'x').sections), ['0:a', '1:a1', '1:a2', '0:x', '0:b']);
  assert.deepEqual(titles(addSectionAfter(base, 'x', 'missing', 'x').sections), ['0:a', '1:a1', '1:a2', '0:b', '0:x']);
});

test('parseToc: page number at the end only after leaders, a tab or 2+ spaces', () => {
  const out = parseToc('1 Thói quen ........ 23\n1.1 Vòng lặp … 30\nChương 2\t41\nPhần  57\nChương 3');
  const t = flatten(buildTree(out)).map((n) => `${n.depth}:${n.section.title}:${n.section.startPage ?? '-'}`);
  assert.deepEqual(t, ['0:1 Thói quen:23', '1:1.1 Vòng lặp:30', '0:Chương 2:41', '0:Phần:57', '0:Chương 3:-']);
});

test('sectionForPage: last start at or before the page, deeper wins a tie', () => {
  let s = setStartPage(base, 'a', 10);
  s = setStartPage(s, 'a1', 10);
  s = setStartPage(s, 'a2', 20);
  s = setStartPage(s, 'b', 40);
  assert.equal(sectionForPage(s, 5), null);
  assert.equal(sectionForPage(s, 10), 'a1');
  assert.equal(sectionForPage(s, 25), 'a2');
  assert.equal(sectionForPage(s, 99), 'b');
  assert.equal(sectionForPage(s, null), null);
  assert.equal(sectionForPage(base, 50), null);
});

test('misplacedByPage: only quotes with a page that points elsewhere', () => {
  const s = setStartPage(setStartPage(base, 'a', 1), 'b', 40);
  const quotes = [
    { id: 'q1', sectionId: 'a', page: 43 },
    { id: 'q2', sectionId: 'b', page: 43 },
    { id: 'q3', sectionId: 'a', page: null },
    { id: 'q4', sectionId: null, page: 5 },
  ];
  assert.deepEqual(
    misplacedByPage(s, quotes).map((m) => `${m.quote.id}>${m.sectionId}`),
    ['q1>b', 'q4>a'],
  );
});
