// The one format legi has: **emphasis** inside a quote, shown in a heavier weight.

export type Run = { text: string; strong: boolean };

export function parseEmph(text: string): Run[] {
  const runs: Run[] = [];
  const re = /\*\*([\s\S]+?)\*\*/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    const at = m.index ?? 0;
    if (at > last) runs.push({ text: text.slice(last, at), strong: false });
    runs.push({ text: m[1], strong: true });
    last = at + m[0].length;
  }
  if (last < text.length) runs.push({ text: text.slice(last), strong: false });
  return runs;
}

/**
 * Wraps the selection in ** or, if it is already wrapped, unwraps it.
 * Returns the new text and the new selection.
 */
export function toggleEmph(text: string, start: number, end: number): { text: string; start: number; end: number } {
  if (start === end) return { text, start, end };
  const before = text.slice(0, start);
  const sel = text.slice(start, end);
  const after = text.slice(end);
  if (before.endsWith('**') && after.startsWith('**')) {
    return { text: before.slice(0, -2) + sel + after.slice(2), start: start - 2, end: end - 2 };
  }
  if (sel.startsWith('**') && sel.endsWith('**') && sel.length >= 4) {
    const inner = sel.slice(2, -2);
    return { text: before + inner + after, start, end: start + inner.length };
  }
  // Keep spaces outside the marks, or Markdown would not read them as emphasis.
  const lead = sel.match(/^\s*/)?.[0] ?? '';
  const trail = sel.match(/\s*$/)?.[0] ?? '';
  const core = sel.slice(lead.length, sel.length - trail.length);
  if (!core) return { text, start, end };
  const wrapped = `${lead}**${core}**${trail}`;
  return { text: before + wrapped + after, start: start + lead.length + 2, end: start + lead.length + 2 + core.length };
}
