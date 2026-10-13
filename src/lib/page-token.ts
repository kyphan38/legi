// "Câu hay p52" → page 52. Only at the very end, so "help52" or a number
// inside the quote is never taken. "tr" is Vietnamese "trang" (page).

const TOKEN = /\s+(?:p|tr)\.?\s?(\d{1,5})\s*$/i;

export function takePageToken(s: string): { text: string; page: number | null } {
  const m = s.match(TOKEN);
  if (!m) return { text: s, page: null };
  const page = Number(m[1]);
  if (page < 1 || page > 20000) return { text: s, page: null };
  return { text: s.slice(0, m.index).trimEnd(), page };
}
