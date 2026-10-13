import { dayOf } from '@/lib/day';
import { exportName, toJson, toMarkdown } from '@/lib/export';
import type { BookRow, QuoteRow } from '@/types/legi';

// Hands a file to the user: the Share sheet where it exists (iPhone PWA,
// where <a download> only opens a preview), a plain download elsewhere.

export async function shareOrDownload(content: string, filename: string, type: string): Promise<void> {
  const blob = new Blob([content], { type });
  try {
    const file = new File([blob], filename, { type });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file] });
      return;
    }
  } catch (err) {
    // The user closed the sheet: nothing to do.
    if ((err as { name?: string })?.name === 'AbortError') return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Safari reads the blob after this returns: revoke much later.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Settings and ⌘K: export everything as one file. */
export async function exportAll(kind: 'md' | 'json', books: BookRow[], quotes: QuoteRow[]): Promise<void> {
  const now = Date.now();
  const name = exportName(dayOf(now), kind);
  if (kind === 'md') await shareOrDownload(toMarkdown(books, quotes), name, 'text/markdown;charset=utf-8');
  else await shareOrDownload(toJson(books, quotes, now), name, 'application/json');
}
