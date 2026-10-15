import assert from 'node:assert/strict';
import { test } from 'node:test';

import { cropRect, dragBox, FULL } from '@/lib/crop';

const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

test('dragBox: corners resize and stay inside the photo', () => {
  const b = dragBox(FULL, 'nw', 0.1, 0.2);
  near(b.x, 0.1);
  near(b.y, 0.2);
  near(b.w, 0.9);
  near(b.h, 0.8);
  const out = dragBox(FULL, 'se', 0.5, 0.5);
  assert.deepEqual(out, FULL);
});

test('dragBox: a corner cannot cross the other side', () => {
  const b = dragBox(FULL, 'ne', -2, 2);
  near(b.w, 0.08);
  near(b.h, 0.08);
  near(b.y, 0.92);
});

test('dragBox: move keeps the size and clamps at the edges', () => {
  const b = dragBox({ x: 0.2, y: 0.2, w: 0.5, h: 0.5 }, 'move', 0.9, -0.9);
  near(b.x, 0.5);
  near(b.y, 0);
  near(b.w, 0.5);
});

test('cropRect: pixels of the box, null for the whole photo', () => {
  assert.equal(cropRect(1000, 2000, FULL), null);
  assert.deepEqual(cropRect(1000, 2000, { x: 0.1, y: 0.25, w: 0.5, h: 0.5 }), { sx: 100, sy: 500, sw: 500, sh: 1000 });
  assert.deepEqual(cropRect(100, 100, { x: 0.95, y: 0, w: 0.5, h: 0.5 }), { sx: 95, sy: 0, sw: 5, sh: 50 });
});
