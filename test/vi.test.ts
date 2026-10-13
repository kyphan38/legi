import assert from 'node:assert/strict';
import { test } from 'node:test';

import { dupKey, fold, foldWithMap, graphemes, looksBroken, nfc, viCollator } from '@/lib/vi';

test('fold removes marks and maps đ', () => {
  assert.equal(fold('Thói Quen'), 'thoi quen');
  assert.equal(fold('Đường đi'), 'duong di');
  assert.equal(fold('  một   **hai** '), 'mot hai');
});

test('nfc composes decomposed marks', () => {
  assert.equal(nfc('e\u0302\u0323'), 'ệ');
  assert.equal(dupKey('Ngu\u031bo\u031b\u0300i'), dupKey('Người'));
});

test('dupKey keeps Vietnamese marks', () => {
  assert.notEqual(dupKey('Ma.'), dupKey('má'));
  assert.equal(dupKey('“Thói quen,” là gì?'), 'thói quen là gì');
});

test('graphemes keeps a decomposed letter whole', () => {
  assert.equal(graphemes('ệ').length, 1);
  assert.equal(graphemes('e\u0302\u0323').length, 1);
  assert.equal(graphemes('Người').length, 5);
});

test('foldWithMap maps folded chars back to graphemes', () => {
  const { folded, map } = foldWithMap('Người ở');
  const at = folded.indexOf('nguoi');
  assert.equal(at, 0);
  assert.deepEqual(map.slice(at, at + 5), [0, 1, 2, 3, 4]);
});

test('looksBroken spots legacy encodings', () => {
  assert.equal(looksBroken('Ng\u00adêi ë l¹i ¸nh s¸ng µ'), true);
  assert.equal(looksBroken('Người ở lại, nghĩ về những điều đã qua.'), false);
  assert.equal(looksBroken('Plain English text.'), false);
});

test('viCollator puts Đ after D', () => {
  assert.deepEqual(['Đen', 'Dao', 'Em'].sort(viCollator.compare), ['Dao', 'Đen', 'Em']);
});
