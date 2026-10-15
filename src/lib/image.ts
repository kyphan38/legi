// Photos are shrunk on the device before they go anywhere: longest side
// 1600px, JPEG 0.8. Enough for the model to read print, small to send.

import { cropRect, FULL, type Box } from '@/lib/crop';

const MAX_SIDE = 1600;
const QUALITY = 0.8;

/** Crop first (on the full photo, so the kept part stays sharp), then shrink. */
export async function shrinkImage(file: Blob, box: Box = FULL): Promise<Blob> {
  // Decoded upright (EXIF applied), the same way <img> shows it, so the box matches.
  const bitmap = await createImageBitmap(file);
  const r = cropRect(bitmap.width, bitmap.height, box) ?? { sx: 0, sy: 0, sw: bitmap.width, sh: bitmap.height };
  const scale = Math.min(1, MAX_SIDE / Math.max(r.sw, r.sh));
  const w = Math.round(r.sw * scale);
  const h = Math.round(r.sh * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No canvas');
  ctx.drawImage(bitmap, r.sx, r.sy, r.sw, r.sh, 0, 0, w, h);
  bitmap.close();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/jpeg', QUALITY));
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).replace(/^data:[^,]+,/, ''));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}
