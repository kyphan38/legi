import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';

import { installFakeStorage } from './fake-storage.ts';
import { clearDraft, readDraft, writeDraft } from '@/lib/draft';
import { mergeTexts } from '@/lib/merge-text';

beforeEach(() => {
  installFakeStorage();
});

test('the composer draft survives and clears per book', () => {
  const d = { text: 'Câu hay.', note: '', page: '12', kind: 'quote' as const, at: 1 };
  writeDraft('u/book1', d);
  writeDraft('u/inbox', { ...d, text: 'Other' });
  assert.deepEqual(readDraft('u/book1'), d);
  clearDraft('u/book1');
  assert.equal(readDraft('u/book1'), null);
  assert.equal(readDraft('u/inbox')?.text, 'Other');
});

test('merging two edits never drops text', () => {
  assert.equal(mergeTexts('a line', 'a line, longer'), 'a line, longer');
  assert.equal(mergeTexts('a line, longer', 'a line'), 'a line, longer');
  assert.equal(mergeTexts('', 'local only'), 'local only');
  assert.equal(mergeTexts('server only', '  '), 'server only');
  const both = mergeTexts('from the iPhone', 'from the Mac');
  assert.ok(both.includes('from the iPhone') && both.includes('from the Mac'));
  assert.ok(both.indexOf('from the iPhone') < both.indexOf('from the Mac'), 'server text comes first');
});
