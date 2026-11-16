import assert from 'node:assert/strict';
import { test } from 'node:test';

import { checkQuery, embedText, scoreOf, textHash } from '../functions/src/vectors.ts';

test('embedText: text without marks, note added, deleted or empty gives null', () => {
  assert.equal(embedText({ text: 'Be **patient** with yourself', note: '', deletedAt: null }), 'Be patient with yourself');
  assert.equal(embedText({ text: 'A', note: 'my note', deletedAt: null }), 'A\nmy note');
  assert.equal(embedText({ text: 'A', note: '', deletedAt: 123 }), null);
  assert.equal(embedText({ text: '   ', note: '', deletedAt: null }), null);
  assert.equal(embedText({ text: 'x'.repeat(5000), deletedAt: null })?.length, 2000);
});

test('textHash changes with the text only', () => {
  assert.equal(textHash('a'), textHash('a'));
  assert.notEqual(textHash('a'), textHash('b'));
});

test('checkQuery trims and refuses empty', () => {
  assert.equal(checkQuery({ query: '  về sự kiên nhẫn ' }), 'về sự kiên nhẫn');
  assert.throws(() => checkQuery({ query: ' ' }));
  assert.throws(() => checkQuery(null));
});

test('scoreOf maps distance to 0-1', () => {
  assert.equal(scoreOf(0), 1);
  assert.equal(scoreOf(0.3), 0.7);
  assert.equal(scoreOf(2), 0);
});
