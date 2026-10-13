// ============================================================
// legi - Photo of a book page → passages (pure: checks, prompt, schema, parse)
//
// The root test suite imports this file directly.
// ============================================================

export const MAX_IMAGES = 4;
/** Base64 chars in total (~6 MB of JPEG). The client sends 1600px JPEGs at 0.8. */
export const MAX_BASE64 = 8_000_000;

export type Mode = 'marked' | 'all';
export type Passage = { text: string; marked: boolean };
export type PageResult = { page: number | null; runningHead: string | null; passages: Passage[] };

export type ExtractInput = { images: string[]; mode: Mode };

/** Throws a short reason when the input is not acceptable. */
export function checkInput(data: unknown): ExtractInput {
  const d = (data ?? {}) as { images?: unknown; mode?: unknown };
  if (!Array.isArray(d.images) || d.images.length === 0) throw new Error('No images');
  if (d.images.length > MAX_IMAGES) throw new Error('Too many images');
  if (!d.images.every((x) => typeof x === 'string' && /^[A-Za-z0-9+/=]+$/.test(x))) throw new Error('Bad image data');
  const total = (d.images as string[]).reduce((n, s) => n + s.length, 0);
  if (total > MAX_BASE64) throw new Error('Images too large');
  const mode: Mode = d.mode === 'all' ? 'all' : 'marked';
  return { images: d.images as string[], mode };
}

export const EXTRACT_SCHEMA = {
  type: 'object',
  properties: {
    pages: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          page: { type: ['integer', 'null'] },
          runningHead: { type: ['string', 'null'] },
          passages: {
            type: 'array',
            items: {
              type: 'object',
              properties: { text: { type: 'string' }, marked: { type: 'boolean' } },
              required: ['text', 'marked'],
            },
          },
        },
        required: ['page', 'runningHead', 'passages'],
      },
    },
  },
  required: ['pages'],
};

export function buildExtractPrompt(mode: Mode, count: number): string {
  return [
    `You read ${count === 1 ? 'a photo of a printed book page' : `${count} photos of printed book pages, in order`}. The book is usually in Vietnamese.`,
    'Return one entry in "pages" per photo.',
    'Rules for the text:',
    '- Copy the printed text exactly as written. Keep every Vietnamese diacritic. Do not fix, translate, shorten or summarize anything.',
    '- Join lines that were broken inside one paragraph. Join a word split by a hyphen at a line end.',
    '- Leave out handwriting in the margins. It is never part of the text.',
    '- "marked" is true when the reader marked that part with a pen or pencil: underlined, bracketed, circled, highlighted, or a line in the margin next to it.',
    mode === 'marked'
      ? '- Return ONLY the marked parts. Each separately marked part is one passage. A part marked across a line break is still one passage.'
      : '- Return the whole page as passages, one per paragraph, with "marked" set for the marked ones.',
    '- "page": the page number printed on the page, or null if none is visible.',
    '- "runningHead": the chapter or section title printed at the top or bottom of the page (not the book title), or null.',
  ].join('\n');
}

/** Model JSON → clean result. Drops empty passages; never throws on odd shapes. */
export function parseExtract(raw: string): PageResult[] {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  const pages = (data as { pages?: unknown })?.pages;
  if (!Array.isArray(pages)) return [];
  return pages.map((p) => {
    const page = Number.isInteger(p?.page) && p.page > 0 && p.page <= 20000 ? (p.page as number) : null;
    const head = typeof p?.runningHead === 'string' && p.runningHead.trim() ? p.runningHead.trim().slice(0, 200) : null;
    const passages: Passage[] = Array.isArray(p?.passages)
      ? p.passages
          .filter((x: unknown) => typeof (x as Passage)?.text === 'string' && (x as Passage).text.trim())
          .map((x: Passage) => ({ text: x.text.normalize('NFC').trim().slice(0, 5000), marked: x.marked === true }))
      : [];
    return { page, runningHead: head, passages };
  });
}
