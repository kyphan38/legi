// ============================================================
// legi - Speech → text (pure: checks, prompt, schema, parse)
//
// The reader says a quote aloud (or a short note). The model writes it down
// word for word, with punctuation. The root test suite imports this file.
// ============================================================

/** Base64 chars (~6 MB of audio, about 2 minutes of AAC / Opus). */
export const MAX_AUDIO_BASE64 = 8_000_000;
export const AUDIO_TYPES = ['audio/webm', 'audio/mp4', 'audio/aac', 'audio/mpeg', 'audio/ogg', 'audio/wav'];

export type VoiceInput = { audio: string; mimeType: string };

export function checkVoice(data: unknown): VoiceInput {
  const d = (data ?? {}) as { audio?: unknown; mimeType?: unknown };
  if (typeof d.audio !== 'string' || d.audio.length === 0) throw new Error('No audio');
  if (d.audio.length > MAX_AUDIO_BASE64) throw new Error('Audio too long');
  if (!/^[A-Za-z0-9+/=]+$/.test(d.audio)) throw new Error('Bad audio data');
  const mimeType = typeof d.mimeType === 'string' ? d.mimeType.split(';')[0].trim().toLowerCase() : '';
  if (!AUDIO_TYPES.includes(mimeType)) throw new Error('Unsupported audio type');
  return { audio: d.audio, mimeType };
}

export const VOICE_SCHEMA = {
  type: 'object',
  properties: { text: { type: 'string' } },
  required: ['text'],
};

export const VOICE_PROMPT = [
  'Write down this recording word for word. The speaker is usually reading a passage from a book aloud, in Vietnamese, or saying a short note.',
  'Rules:',
  '- Keep the exact words. Do not fix, translate, shorten, summarize or add anything.',
  '- Keep every Vietnamese diacritic.',
  '- Add normal punctuation and capital letters where a sentence starts.',
  '- If the speaker says "xuống dòng", start a new line there. If they say "đoạn mới", leave one blank line there. Do not write those words.',
  '- Leave out filler sounds (ờ, ừm) and false starts.',
  '- If there is no speech, return an empty text.',
].join('\n');

export function parseVoice(raw: string): string {
  try {
    const t = (JSON.parse(raw) as { text?: unknown })?.text;
    return typeof t === 'string' ? t.normalize('NFC').trim().slice(0, 5000) : '';
  } catch {
    return '';
  }
}
