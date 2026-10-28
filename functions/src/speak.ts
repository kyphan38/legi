// ============================================================
// legi - Text → speech with Google Chirp 3 HD (pure: checks, split, request)
//
// Read slowly sends one quote, gets one MP3 back. The root test suite imports
// this file.
// ============================================================

export const MAX_TEXT = 5000;
// Google takes at most 5000 bytes per request; Vietnamese letters are 2-3 bytes.
export const MAX_PART_BYTES = 3000;
export const LANGS = ['vi-VN', 'en-US'] as const;

export type SpeakInput = { text: string; lang: (typeof LANGS)[number]; voice: string };

export function checkSpeak(data: unknown): SpeakInput {
  const d = (data ?? {}) as { text?: unknown; lang?: unknown; voice?: unknown };
  const text = typeof d.text === 'string' ? d.text.replace(/\*\*/g, '').trim() : '';
  if (!text) throw new Error('No text');
  if (text.length > MAX_TEXT) throw new Error('Text too long');
  const lang = LANGS.find((l) => l === d.lang);
  if (!lang) throw new Error('Unsupported language');
  // A Chirp 3 HD voice name, e.g. "Charon".
  if (typeof d.voice !== 'string' || !/^[A-Z][a-z]{2,20}$/.test(d.voice)) throw new Error('Bad voice');
  return { text, lang, voice: d.voice };
}

const bytes = (s: string) => new TextEncoder().encode(s).length;

/** Splits at sentence ends (then commas, then spaces) so each part stays under maxBytes. */
export function splitForSpeech(text: string, maxBytes = MAX_PART_BYTES): string[] {
  if (bytes(text) <= maxBytes) return [text];
  const out: string[] = [];
  let buf = '';
  const push = (piece: string) => {
    if (buf && bytes(`${buf} ${piece}`) > maxBytes) {
      out.push(buf);
      buf = piece;
    } else buf = buf ? `${buf} ${piece}` : piece;
  };
  for (const sentence of text.split(/(?<=[.!?…:;\n])\s+/)) {
    if (bytes(sentence) <= maxBytes) push(sentence);
    else for (const word of sentence.split(/\s+/)) push(word);
  }
  if (buf) out.push(buf);
  return out;
}

export function synthesizeBody(text: string, lang: string, voice: string) {
  return {
    input: { text },
    voice: { languageCode: lang, name: `${lang}-Chirp3-HD-${voice}` },
    audioConfig: { audioEncoding: 'MP3' },
  };
}
