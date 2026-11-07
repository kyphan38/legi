// ============================================================
// legi - Spoken table of contents → new sections (pure: checks, prompt, schema, parse)
//
// The reader says which sections to add, with pages, and where ("under
// <section>"). The model writes them down; the app shows them for review
// before anything is saved. The root test suite imports this file.
// ============================================================

import { checkVoice, type VoiceInput } from './voice.ts';

export const MAX_OUTLINE = 500;

/** A section the book already has, in reading order. */
export type OutlineLine = { id: string; title: string; depth: number; page: number | null };
/** `parent`: an existing section id, the key of an earlier new item, or null (top level). */
export type TocItem = { key: string; title: string; page: number | null; parent: string | null };

export type TocInput = VoiceInput & { outline: OutlineLine[] };

export function checkTocInput(data: unknown): TocInput {
  const voice = checkVoice(data);
  const raw = (data as { outline?: unknown }).outline;
  if (!Array.isArray(raw) || raw.length > MAX_OUTLINE) throw new Error('Bad outline');
  const outline = raw.map((x: unknown) => {
    const o = (x ?? {}) as Record<string, unknown>;
    if (typeof o.id !== 'string' || !/^[A-Za-z0-9_-]{1,40}$/.test(o.id)) throw new Error('Bad outline');
    return {
      id: o.id,
      title: typeof o.title === 'string' ? o.title.slice(0, 200) : '',
      depth: Number.isInteger(o.depth) ? Math.min(Math.max(o.depth as number, 0), 10) : 0,
      page: Number.isInteger(o.page) ? (o.page as number) : null,
    };
  });
  return { ...voice, outline };
}

export const TOC_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          key: { type: 'string' },
          title: { type: 'string' },
          page: { type: ['integer', 'null'] },
          parent: { type: ['string', 'null'] },
        },
        required: ['key', 'title', 'page', 'parent'],
      },
    },
  },
  required: ['items'],
};

export function buildTocPrompt(outline: OutlineLine[]): string {
  const lines = outline.map((o) => `${'  '.repeat(o.depth)}[${o.id}] ${o.title}${o.page !== null ? ` (p. ${o.page})` : ''}`);
  return [
    'The speaker is building the table of contents of a book, usually in Vietnamese. Listen and return the sections they want to add.',
    'The book already has these sections (id in brackets, indent = depth):',
    lines.length ? lines.join('\n') : '(none)',
    'Rules:',
    '- One item per section to add, in the order spoken.',
    '- "title": the section name as spoken, with every Vietnamese diacritic. Start with a capital letter, no trailing period. Do not add, shorten or translate words.',
    '- "page": the page number said for it ("trang 120" = 120), or null.',
    '- "key": a new id for the item: "n1", "n2", ...',
    '- "parent": where the item goes. Use the id of an existing section when the speaker says to put items under it (match the title loosely, ignoring marks and case). Use the key of an earlier new item when the item belongs under that new one. Use null for the top level.',
    '- When the speaker names a parent once, the items that follow stay under it until they name another place.',
    '- Leave out instructions to you ("tạo cho tôi", "tiếp theo là"), filler sounds and false starts.',
    '- If there is no speech, return no items.',
  ].join('\n');
}

/** Model JSON → clean items. Unknown parents become top level; never throws. */
export function parseTocItems(raw: string, knownIds: string[]): TocItem[] {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  const items = (data as { items?: unknown })?.items;
  if (!Array.isArray(items)) return [];
  const known = new Set(knownIds);
  const keys = new Set<string>();
  const out: TocItem[] = [];
  for (const x of items.slice(0, 200)) {
    const title = typeof x?.title === 'string' ? x.title.normalize('NFC').trim().replace(/[.。]+$/, '').slice(0, 200) : '';
    if (!title) continue;
    const key = typeof x.key === 'string' && x.key && !keys.has(x.key) && !known.has(x.key) ? x.key.slice(0, 40) : `n${out.length + 1}-${keys.size}`;
    const page = Number.isInteger(x.page) && x.page > 0 && x.page <= 20000 ? (x.page as number) : null;
    // A parent must already exist: an outline section, or an item listed before this one.
    const parent = typeof x.parent === 'string' && (known.has(x.parent) || keys.has(x.parent)) ? x.parent : null;
    keys.add(key);
    out.push({ key, title, page, parent });
  }
  return out;
}
