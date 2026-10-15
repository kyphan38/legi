import assert from 'node:assert/strict';
import { test } from 'node:test';

import { guessSection, initialPicks } from '@/lib/capture';
import type { Section } from '@/types/legi';

import { buildExtractPrompt, checkInput, MAX_IMAGES, parseExtract } from '../functions/src/extract.ts';

const sections: Section[] = [
  { id: 'c3', title: 'Chương 3: Vòng lặp thói quen', parentId: null, order: 1 },
  { id: 'c4', title: 'Chương 4: Người đàn ông trông không ổn', parentId: null, order: 2 },
];

test('guessSection matches the running head, ignoring marks and case', () => {
  assert.equal(guessSection('CHƯƠNG 3: VÒNG LẶP THÓI QUEN', sections, null), 'c3');
  assert.equal(guessSection('Vong lap thoi quen', sections, null), 'c3');
  assert.equal(guessSection('Atomic Habits', sections, 'c4'), 'c4');
  assert.equal(guessSection(null, sections, 'c4'), 'c4');
});

test('guessSection prefers the printed page when sections have first pages', () => {
  const paged = sections.map((s) => ({ ...s, startPage: s.id === 'c3' ? 40 : 60 }));
  assert.equal(guessSection('CHƯƠNG 3: VÒNG LẶP THÓI QUEN', paged, null, 61), 'c4');
  assert.equal(guessSection('CHƯƠNG 3: VÒNG LẶP THÓI QUEN', paged, null, 10), 'c3');
  assert.equal(guessSection(null, paged, null, null), null);
});

test('initialPicks ticks marked passages that are not saved yet', () => {
  const picks = initialPicks(
    [
      { text: 'a', marked: true },
      { text: 'b', marked: false },
      { text: 'c', marked: true },
    ],
    (t) => t === 'c',
  );
  assert.deepEqual(picks, [true, false, false]);
});

test('checkInput: count, size, data, mode', () => {
  assert.throws(() => checkInput({}), /No images/);
  assert.throws(() => checkInput({ images: Array(MAX_IMAGES + 1).fill('QQ==') }), /Too many/);
  assert.throws(() => checkInput({ images: ['not base64!'] }), /Bad image/);
  assert.throws(() => checkInput({ images: ['A'.repeat(8_000_001)] }), /too large/);
  assert.deepEqual(checkInput({ images: ['QQ=='] }), { images: ['QQ=='], mode: 'marked' });
  assert.equal(checkInput({ images: ['QQ=='], mode: 'all' }).mode, 'all');
});

test('parseExtract cleans odd model output', () => {
  assert.deepEqual(parseExtract('not json'), []);
  assert.deepEqual(parseExtract('{"pages": 3}'), []);
  const out = parseExtract(
    JSON.stringify({
      pages: [{ page: 52, runningHead: '  Chương 3 ', passages: [{ text: ' Câu một ', marked: true }, { text: '   ', marked: true }, { text: 'Câu hai' }] }, { page: -1, runningHead: '', passages: 'x' }],
    }),
  );
  assert.deepEqual(out, [
    { page: 52, runningHead: 'Chương 3', passages: [{ text: 'Câu một', marked: true }, { text: 'Câu hai', marked: false }] },
    { page: null, runningHead: null, passages: [] },
  ]);
});

test('the prompt asks for exact text and marked parts only', () => {
  const p = buildExtractPrompt('marked', 1);
  assert.match(p, /exactly/);
  assert.match(p, /ONLY the marked parts/);
  assert.match(buildExtractPrompt('all', 2), /whole page/);
});

import { checkVoice, parseVoice, VOICE_PROMPT } from '../functions/src/voice.ts';

test('checkVoice: audio data, size, type', () => {
  assert.throws(() => checkVoice({}), /No audio/);
  assert.throws(() => checkVoice({ audio: 'QQ==', mimeType: 'video/mp4' }), /Unsupported/);
  assert.throws(() => checkVoice({ audio: 'A'.repeat(8_000_001), mimeType: 'audio/mp4' }), /too long/);
  assert.throws(() => checkVoice({ audio: 'bad data!', mimeType: 'audio/mp4' }), /Bad audio/);
  assert.deepEqual(checkVoice({ audio: 'QQ==', mimeType: 'audio/webm;codecs=opus' }), { audio: 'QQ==', mimeType: 'audio/webm' });
});

test('parseVoice and the prompt', () => {
  assert.equal(parseVoice('{"text":"  Thói quen là lãi kép. "}'), 'Thói quen là lãi kép.');
  assert.equal(parseVoice('nope'), '');
  assert.match(VOICE_PROMPT, /word for word/);
  assert.match(VOICE_PROMPT, /xuống dòng/);
});
