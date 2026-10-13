import assert from 'node:assert/strict';
import { test } from 'node:test';

import { addSection, buildTree, flatten, indent, moveDown, moveUp, outdent, parseToc, pathOf, removeSection, subtreeIds } from '@/lib/outline';
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
