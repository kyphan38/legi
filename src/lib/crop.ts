// ============================================================
// legi - Crop box math (pure)
//
// The box lives in 0..1 of the shown photo, so it survives a resize or a
// rotated phone. Pixels are only worked out at the end, on the full photo.
// ============================================================

export type Box = { x: number; y: number; w: number; h: number };
export type Handle = 'nw' | 'ne' | 'sw' | 'se' | 'move';

export const FULL: Box = { x: 0, y: 0, w: 1, h: 1 };
const MIN = 0.08;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** The box after dragging a handle by (dx, dy), both in 0..1 of the photo. */
export function dragBox(box: Box, handle: Handle, dx: number, dy: number): Box {
  if (handle === 'move') {
    return { ...box, x: clamp(box.x + dx, 0, 1 - box.w), y: clamp(box.y + dy, 0, 1 - box.h) };
  }
  let left = box.x;
  let top = box.y;
  let right = box.x + box.w;
  let bottom = box.y + box.h;
  if (handle === 'nw' || handle === 'sw') left = clamp(left + dx, 0, right - MIN);
  else right = clamp(right + dx, left + MIN, 1);
  if (handle === 'nw' || handle === 'ne') top = clamp(top + dy, 0, bottom - MIN);
  else bottom = clamp(bottom + dy, top + MIN, 1);
  return { x: left, y: top, w: right - left, h: bottom - top };
}

/** Whole pixels of the photo to keep; null when the box is (almost) the whole photo. */
export function cropRect(width: number, height: number, box: Box): { sx: number; sy: number; sw: number; sh: number } | null {
  const sx = Math.round(clamp(box.x, 0, 1) * width);
  const sy = Math.round(clamp(box.y, 0, 1) * height);
  const sw = Math.max(1, Math.min(width - sx, Math.round(box.w * width)));
  const sh = Math.max(1, Math.min(height - sy, Math.round(box.h * height)));
  if (sw >= width - 2 && sh >= height - 2) return null;
  return { sx, sy, sw, sh };
}
