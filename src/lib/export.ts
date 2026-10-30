// ============================================================
// legi - Export (Markdown and JSON). Pure file.
// ============================================================

import { buildTree, flatten } from '@/lib/outline';
import { sortQuotes } from '@/lib/order';
import { viCollator } from '@/lib/vi';
import type { BookRow, QuoteRow } from '@/types/legi';

// Same format as a legi-quotes file, so an export pastes back in
// (splitMarked in paste.ts reads it): each quote starts with "--- p52",
// book info sits on "> " lines.
function quoteBlock(q: QuoteRow): string {
  const marker = q.page !== null ? `--- p${q.page}` : '---';
  const lead = q.kind === 'thought' ? 'Thought: ' : q.kind === 'question' ? 'Question: ' : '';
  let out = `${marker}\n${lead}${q.text}`;
  if (q.note.trim()) out += `\n\nNote: ${q.note.trim()}`;
  return out;
}

/** One book. `quotes` may hold any quotes: only this book's live ones are used. */
export function bookToMarkdown(book: BookRow, quotes: QuoteRow[], level = 1): string {
  const mine = sortQuotes(quotes.filter((q) => q.bookId === book.id && q.deletedAt === null));
  const known = new Set(book.sections.map((s) => s.id));
  const parts: string[] = [`${'#'.repeat(level)} ${book.title}`];
  if (book.author) parts.push(`> ${book.author}`);
  if (book.takeaway) parts.push(`> What stays with you: ${book.takeaway}`);
  const top = mine.filter((q) => !q.sectionId || !known.has(q.sectionId));
  top.forEach((q) => parts.push(quoteBlock(q)));
  for (const node of flatten(buildTree(book.sections))) {
    parts.push(`${'#'.repeat(Math.min(6, level + 1 + node.depth))} ${node.section.title}`);
    mine.filter((q) => q.sectionId === node.section.id).forEach((q) => parts.push(quoteBlock(q)));
  }
  return parts.join('\n\n') + '\n';
}

export function toMarkdown(books: BookRow[], quotes: QuoteRow[]): string {
  const live = books.filter((b) => b.deletedAt === null).sort((a, b) => viCollator.compare(a.title, b.title));
  const parts = live.map((b) => bookToMarkdown(b, quotes).trimEnd());
  const inbox = sortQuotes(quotes.filter((q) => q.bookId === null && q.deletedAt === null));
  if (inbox.length) parts.push(['# Inbox', ...inbox.map(quoteBlock)].join('\n\n'));
  return parts.join('\n\n\n') + '\n';
}

export function toJson(books: BookRow[], quotes: QuoteRow[], now: number): string {
  const liveBooks = books.filter((b) => b.deletedAt === null);
  const ids = new Set(liveBooks.map((b) => b.id));
  const liveQuotes = quotes.filter((q) => q.deletedAt === null && (q.bookId === null || ids.has(q.bookId)));
  return JSON.stringify({ app: 'legi', version: 1, exportedAt: now, books: liveBooks, quotes: liveQuotes }, null, 2);
}

export function exportName(day: string, ext: 'md' | 'json'): string {
  return `legi-${day}.${ext}`;
}
