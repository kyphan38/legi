// ============================================================
// legi - Pasted text and splitting into quotes
//
// A blank line separates two quotes (that is how the owner already writes).
// Lines starting with #, ##, ### are headings → sections (for pasting old notes).
// ============================================================

import { nfc } from '@/lib/vi';

export type Block =
  | { type: 'heading'; depth: number; title: string }
  | { type: 'quote'; text: string };

const SOFT_HYPHEN = new RegExp(String.fromCharCode(0xad), 'g');
const SENTENCE_END = /[.!?:…”"]$/;
const LINE_START_KEEP = /^(\p{Lu}|[-•]|\d+\.)/u;

/**
 * Cleans text copied from a PDF: joins words split by a hyphen at a line end,
 * drops lines that are only a page number, and joins hard-wrapped lines inside
 * a paragraph. A line break stays only after a sentence end followed by a
 * capital, a bullet or a number.
 */
export function cleanPaste(raw: string): string {
  const text = nfc(raw)
    .replace(/\r\n?/g, '\n')
    .replace(SOFT_HYPHEN, '')
    .replace(/(\p{L})-\n(\p{Ll})/gu, '$1$2');

  const paragraphs = text.split(/\n[ \t]*\n/);
  return paragraphs
    .map((para) => {
      const lines = para
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l !== '' && !/^[-–]?\s*\d{1,4}\s*[-–]?$/.test(l));
      let out = '';
      for (const line of lines) {
        if (out === '') out = line;
        else if (/^#{1,3}\s/.test(line) || /^#{1,3}\s/.test(out.split('\n').at(-1) ?? '')) out += '\n' + line;
        else if (SENTENCE_END.test(out) && LINE_START_KEEP.test(line)) out += '\n' + line;
        else out += ' ' + line;
      }
      return out.replace(/[ \t]{2,}/g, ' ');
    })
    .filter((p) => p !== '')
    .join('\n\n');
}

/** Splits on blank lines; heading lines (# .. ###) become their own blocks. */
export function splitBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  for (const para of text.split(/\n[ \t]*\n/)) {
    let buf: string[] = [];
    const flush = () => {
      const t = buf.join('\n').trim();
      if (t) blocks.push({ type: 'quote', text: t });
      buf = [];
    };
    for (const line of para.split('\n')) {
      const h = line.match(/^(#{1,3})\s+(.+?)\s*$/);
      if (h) {
        flush();
        blocks.push({ type: 'heading', depth: h[1].length, title: h[2] });
      } else {
        buf.push(line);
      }
    }
    flush();
  }
  return blocks;
}

export function countBlocks(blocks: Block[]): { quotes: number; headings: number } {
  return {
    quotes: blocks.filter((b) => b.type === 'quote').length,
    headings: blocks.filter((b) => b.type === 'heading').length,
  };
}
