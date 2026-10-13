// ============================================================
// legi - Vietnamese text helpers
//
// Pure file (no DOM, no Firestore), tested with node:test.
// Search ignores marks ("thoi quen" finds "thói quen"); duplicate checks keep
// them ("ma" and "má" are different words).
// ============================================================

const MARKS = /\p{M}/gu;
const EMPH = /\*\*/g;

export function nfc(s: string): string {
  return s.normalize('NFC');
}

/** One grapheme without its marks, lowercased. đ has no decomposition, so it is mapped by hand. */
function foldOne(g: string): string {
  return g.normalize('NFD').replace(MARKS, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
}

/** For search: no marks, đ→d, lowercase, one space between words, no ** marks. */
export function fold(s: string): string {
  return foldOne(s.replace(EMPH, '')).replace(/\s+/g, ' ').trim();
}

const segmenter: Intl.Segmenter | null =
  typeof Intl !== 'undefined' && 'Segmenter' in Intl ? new Intl.Segmenter('vi', { granularity: 'grapheme' }) : null;

/** Splits into visible characters: "ệ" is one item even when typed as e + two marks. */
export function graphemes(s: string): string[] {
  if (!segmenter) return Array.from(s);
  return Array.from(segmenter.segment(s), (x) => x.segment);
}

/**
 * Folds grapheme by grapheme and keeps, for each char of the result, the index
 * of the grapheme it came from. Lets search highlight the right part of the
 * original text. Unlike fold(), keeps spacing as is so indexes stay simple.
 */
export function foldWithMap(s: string): { folded: string; map: number[]; parts: string[] } {
  const parts = graphemes(s);
  let folded = '';
  const map: number[] = [];
  parts.forEach((g, i) => {
    const f = foldOne(g);
    for (const ch of f) {
      folded += ch;
      map.push(i);
    }
  });
  return { folded, map, parts };
}

/** For duplicate checks: NFC, lowercase, no punctuation or symbols, KEEPS Vietnamese marks. */
export function dupKey(s: string): string {
  return nfc(s)
    .replace(EMPH, '')
    .toLowerCase()
    .replace(/[\p{P}\p{S}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Chars that show up when TCVN3 / VNI text is read as Unicode.
const LEGACY = new Set(Array.from('¸µ¶·¹¨©ª«¬®¯°±²³´½¾ÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖ×ØÙÚÛÜÝÞßøù'));
// Toned letters that only exist in real (Unicode) Vietnamese. Plain â/ê/ô
// are left out: they also show up in misread TCVN3 text.
const VIET = /[ạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/iu;

/** True when pasted text looks like a PDF in an old Vietnamese encoding. */
export function looksBroken(s: string): boolean {
  const text = nfc(s);
  if (/(^|[^\p{L}])\p{M}/u.test(text)) return true;
  const chars = Array.from(text).filter((c) => !/\s/.test(c));
  if (chars.length === 0) return false;
  const odd = chars.filter((c) => LEGACY.has(c) || c === '\u00ad').length;
  return odd / chars.length > 0.05 && !VIET.test(text);
}

export const viCollator = new Intl.Collator('vi', { sensitivity: 'base' });
