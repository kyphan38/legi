// ============================================================
// legi - Pasted text and splitting into quotes
//
// A blank line separates two quotes (that is how the owner already writes).
// Lines starting with #, ##, ### are headings → sections (for pasting old notes).
// Notes from legi-quotes and legi's own export start each quote with a
// "--- p13" line instead: then only those lines split, and blank lines stay as
// paragraphs inside a quote. The same format both ways, so an export can be
// edited and pasted back (see export.ts).
// ============================================================

import { nfc } from '@/lib/vi';
import type { QuoteKind } from '@/types/legi';

export type Block =
  | { type: 'heading'; depth: number; title: string }
  | { type: 'quote'; text: string; note?: string; kind?: QuoteKind };

const SOFT_HYPHEN = new RegExp(String.fromCharCode(0xad), 'g');
const SENTENCE_END = /[.!?:…”"]$/;
const LINE_START_KEEP = /^(\p{Lu}|[-•]|\d+\.)/u;
// "---", "--- p13", "--- tr.13".
const MARKER = /^[ \t]*---[ \t]*(?:(?:p|tr)\.?[ \t]?(\d{1,5}))?[ \t]*$/i;
const HEADING = /^(#{1,3})\s+(.+?)\s*$/;
// The export nests sections up to ######.
const DEEP_HEADING = /^(#{1,6})\s+(.+?)\s*$/;
const KIND_LEAD: [string, QuoteKind][] = [
  ['Thought: ', 'thought'],
  ['Question: ', 'question'],
];

/** "Thought: x\n\nNote: y" → text x, kind thought, note y. */
function readQuote(t: string): Extract<Block, { type: 'quote' }> {
  const out: Extract<Block, { type: 'quote' }> = { type: 'quote', text: t };
  const at = t.indexOf('\n\nNote: ');
  if (at > 0) {
    out.note = t.slice(at + '\n\nNote: '.length).trim();
    out.text = t.slice(0, at).trim();
  }
  const lead = KIND_LEAD.find(([l]) => out.text.startsWith(l));
  if (lead) {
    out.kind = lead[1];
    out.text = out.text.slice(lead[0].length).trim();
  }
  return out;
}

/** True when the text uses "--- p13" lines to start each quote. */
export const isMarked = (text: string) => text.split('\n').some((l) => MARKER.test(l));

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
        const prev = out.split('\n').at(-1) ?? '';
        if (out === '') out = line;
        else if (/^#{1,3}\s/.test(line) || /^#{1,3}\s/.test(prev) || MARKER.test(line) || MARKER.test(prev)) out += '\n' + line;
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
      const h = line.match(HEADING);
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

/**
 * Splits text in the "--- p13" format: each marker starts a quote and gives
 * its page; a bare "---" takes `fallback` (the page field). Headings (up to
 * ######) are their own blocks. "> " lines between a heading and its first
 * marker are the export's book info and are skipped. A last paragraph
 * "Note: ..." is the note, a lead "Thought: " or "Question: " the kind.
 * Blank lines inside a quote stay as one paragraph break. `pages` lines up
 * with `blocks`; headings get null.
 */
export function splitMarked(text: string, fallback: number | null): { blocks: Block[]; pages: (number | null)[] } {
  const blocks: Block[] = [];
  const pages: (number | null)[] = [];
  let page = fallback;
  let inQuote = false;
  let buf: string[] = [];
  const flush = () => {
    const t = buf
      .join('\n')
      .replace(/\n[ \t]*\n(?:[ \t]*\n)*/g, '\n\n')
      .trim();
    if (t) {
      blocks.push(readQuote(t));
      pages.push(page);
    }
    buf = [];
  };
  for (const line of text.split('\n')) {
    const m = line.match(MARKER);
    const h = m ? null : line.match(DEEP_HEADING);
    if (m) {
      flush();
      const n = m[1] ? Number(m[1]) : 0;
      page = n >= 1 && n <= 20000 ? n : fallback;
      inQuote = true;
    } else if (h) {
      flush();
      blocks.push({ type: 'heading', depth: h[1].length, title: h[2] });
      pages.push(null);
      inQuote = false;
    } else if (!inQuote && line.startsWith('> ')) {
      continue;
    } else {
      buf.push(line);
    }
  }
  flush();
  return { blocks, pages };
}

/** "Keep as one" for marked text: marker lines go, paragraphs stay. */
export function dropMarkers(text: string): string {
  return text
    .split('\n')
    .filter((l) => !MARKER.test(l))
    .join('\n')
    .replace(/\n[ \t]*\n(?:[ \t]*\n)*/g, '\n\n')
    .trim();
}

export function countBlocks(blocks: Block[]): { quotes: number; headings: number } {
  return {
    quotes: blocks.filter((b) => b.type === 'quote').length,
    headings: blocks.filter((b) => b.type === 'heading').length,
  };
}
