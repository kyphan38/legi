// ============================================================
// legi - Read aloud (pure parts)
//
// Uses the device's own voices (speechSynthesis): free, offline, no server.
// Text is spoken in short chunks because Chrome cuts off one long utterance
// after about 15 seconds.
// ============================================================

const MAX_CHUNK = 220;

// Letters only Vietnamese uses (not the French é/à/ò...), so English quotes keep an English voice.
const VI_LETTERS = /[ăắằẳẵặâấầẩẫậđêếềểễệôốồổỗộơớờởỡợưứừửữựạảẹẻẽịỉọỏụủỳỵỷỹ]/i;

export function voiceLang(text: string): 'vi-VN' | 'en-US' {
  return VI_LETTERS.test(text) ? 'vi-VN' : 'en-US';
}

/** Sentences (and lines) of the quote, each at most MAX_CHUNK chars; `**` marks dropped. */
export function speechChunks(text: string): string[] {
  const out: string[] = [];
  for (const line of text.replace(/\*\*/g, '').split(/\n+/)) {
    for (const sentence of line.split(/(?<=[.!?…:;])\s+/)) {
      let buf = '';
      for (const part of sentence.split(/(?<=,)\s+/)) {
        if (buf && buf.length + 1 + part.length > MAX_CHUNK) {
          out.push(buf);
          buf = part;
        } else buf = buf ? `${buf} ${part}` : part;
      }
      out.push(buf);
    }
  }
  return out.map((s) => s.trim()).filter(Boolean);
}

/** The best installed voice for a language: exact match first, then on-device voices. */
export function pickVoice(voices: SpeechSynthesisVoice[], lang: string): SpeechSynthesisVoice | null {
  const base = lang.slice(0, 2);
  const fits = voices.filter((v) => v.lang.replace('_', '-').toLowerCase().startsWith(base));
  const rank = (v: SpeechSynthesisVoice) => (v.lang.replace('_', '-') === lang ? 0 : 2) + (v.localService ? 0 : 1);
  return fits.sort((a, b) => rank(a) - rank(b))[0] ?? null;
}
