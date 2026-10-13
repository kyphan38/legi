// ============================================================
// legi - Tidy text on save
//
// Runs on commit only, never while typing: changing text under the caret
// makes it jump. Never capitalizes and never fixes spelling - a quote must
// stay as printed.
// ============================================================

import { nfc } from '@/lib/vi';

const SOFT_HYPHEN = new RegExp(String.fromCharCode(0xad), 'g');

function curlyDoubles(line: string): string {
  let out = '';
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c !== '"') {
      out += c;
      continue;
    }
    const prev = i === 0 ? '' : line[i - 1];
    out += prev === '' || /[\s([{]/.test(prev) ? '“' : '”';
  }
  return out;
}

export function tidy(s: string): string {
  return nfc(s)
    .replace(/\r\n?/g, '\n')
    .replace(SOFT_HYPHEN, '')
    .replace(/\.\.\./g, '…')
    .split('\n')
    .map((line) =>
      curlyDoubles(line)
        .replace(/(\p{L})'(\p{L})/gu, '$1’$2')
        .replace(/[ \t]{2,}/g, ' ')
        .replace(/[ \t]+$/g, ''),
    )
    .join('\n')
    .replace(/^\s*\n/, '')
    .replace(/\n\s*$/, '')
    .replace(/^[ \t]+/, '');
}
