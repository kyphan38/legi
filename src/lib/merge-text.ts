// Copied from hodi/src/lib/page-data.ts.

/**
 * Merges two versions when this device and another edited the same quote (e.g.
 * offline on the Mac while the iPhone changed it). Never drops either side's
 * text: if one contains the other, take the longer; else server first.
 */
export function mergeTexts(remote: string, local: string): string {
  const r = remote.trim();
  const l = local.trim();
  if (!l || r.includes(l)) return remote;
  if (!r || l.includes(r)) return local;
  return `${remote.trimEnd()}\n\n${local.trimStart()}`;
}
