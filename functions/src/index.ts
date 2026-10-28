// ============================================================
// legi - Cloud Functions: photo OCR, voice to text, text to speech
//
// The site stays a static export. These functions exist because the Gemini
// key and Google Cloud access must not reach the browser. It checks the same email as
// firestore.rules, keeps nothing (no images, no text) and logs no content.
// ============================================================

import { GoogleGenAI } from '@google/genai';
import { applicationDefault } from 'firebase-admin/app';
import { setGlobalOptions } from 'firebase-functions';
import { HttpsError, onCall } from 'firebase-functions/https';
import { logger } from 'firebase-functions';
import { defineSecret, defineString } from 'firebase-functions/params';

import { isAllowed } from './access.ts';
import { buildExtractPrompt, checkInput, EXTRACT_SCHEMA, parseExtract } from './extract.ts';
import { checkSpeak, splitForSpeech, synthesizeBody } from './speak.ts';
import { checkVoice, parseVoice, VOICE_PROMPT, VOICE_SCHEMA } from './voice.ts';

setGlobalOptions({ region: 'asia-southeast1', maxInstances: 2 });

const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');
const ALLOWED_USER_EMAIL = defineString('ALLOWED_USER_EMAIL');
const GEMINI_MODEL = defineString('GEMINI_MODEL', { default: 'gemini-4-argon' });
// The Google Cloud project that pays for Text-to-Speech (shared with the anki skill).
const TTS_QUOTA_PROJECT = defineString('TTS_QUOTA_PROJECT', { default: '' });

let client: GoogleGenAI | null = null;
let clientKey = '';

function gemini(): GoogleGenAI {
  const key = GEMINI_API_KEY.value();
  if (!client || clientKey !== key) {
    client = new GoogleGenAI({ apiKey: key });
    clientKey = key;
  }
  return client;
}

function guard(auth: { token: Parameters<typeof isAllowed>[0] } | undefined): void {
  if (!auth || !isAllowed(auth.token, ALLOWED_USER_EMAIL.value())) {
    throw new HttpsError('permission-denied', 'Not allowed');
  }
}

/** The quote said aloud → text. The audio is not kept anywhere. */
export const transcribe = onCall({ secrets: [GEMINI_API_KEY], timeoutSeconds: 120, memory: '512MiB' }, async (req) => {
  guard(req.auth);
  let input;
  try {
    input = checkVoice(req.data);
  } catch (err) {
    throw new HttpsError('invalid-argument', err instanceof Error ? err.message : 'Bad input');
  }
  try {
    const res = await gemini().models.generateContent({
      model: GEMINI_MODEL.value(),
      contents: [{ role: 'user', parts: [{ text: VOICE_PROMPT }, { inlineData: { mimeType: input.mimeType, data: input.audio } }] }],
      config: { temperature: 0, responseMimeType: 'application/json', responseJsonSchema: VOICE_SCHEMA, httpOptions: { timeout: 100_000 } },
    });
    return { text: parseVoice(res.text ?? '') };
  } catch (err) {
    // The error only: never what was said.
    logger.error('transcribe failed', err instanceof Error ? err.message : String(err));
    throw new HttpsError('unavailable', 'Model call failed');
  }
});

// Cloud TTS takes no API key: the function's own service account calls it, and
// TTS_QUOTA_PROJECT pays (that account needs Service Usage Consumer there).
// In the emulator (no service account) a gcloud token can be passed in instead.
async function ttsHeaders(): Promise<Record<string, string>> {
  const quota: Record<string, string> = TTS_QUOTA_PROJECT.value() ? { 'x-goog-user-project': TTS_QUOTA_PROJECT.value() } : {};
  const devToken = process.env.FUNCTIONS_EMULATOR === 'true' ? process.env.TTS_ACCESS_TOKEN : undefined;
  if (devToken) return { Authorization: `Bearer ${devToken}`, ...quota };
  const { access_token } = await applicationDefault().getAccessToken();
  return { Authorization: `Bearer ${access_token}`, ...quota };
}

/** A quote → MP3 (base64), Chirp 3 HD voice. Nothing is kept. */
export const speak = onCall({ timeoutSeconds: 60 }, async (req) => {
  guard(req.auth);
  let input;
  try {
    input = checkSpeak(req.data);
  } catch (err) {
    throw new HttpsError('invalid-argument', err instanceof Error ? err.message : 'Bad input');
  }
  try {
    const headers = { 'Content-Type': 'application/json', ...(await ttsHeaders()) };
    const parts: Buffer[] = [];
    // MP3 frames play back to back, so the parts can simply be joined.
    for (const text of splitForSpeech(input.text)) {
      const res = await fetch('https://texttospeech.googleapis.com/v1/text:synthesize', {
        method: 'POST',
        headers,
        body: JSON.stringify(synthesizeBody(text, input.lang, input.voice)),
        signal: AbortSignal.timeout(50_000),
      });
      if (!res.ok) throw new Error(`TTS HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
      parts.push(Buffer.from(((await res.json()) as { audioContent: string }).audioContent, 'base64'));
    }
    return { audio: Buffer.concat(parts).toString('base64') };
  } catch (err) {
    // The error only: never the quote.
    logger.error('speak failed', err instanceof Error ? err.message : String(err));
    throw new HttpsError('unavailable', 'Speech call failed');
  }
});

export const extractPage = onCall({ secrets: [GEMINI_API_KEY], timeoutSeconds: 120, memory: '512MiB' }, async (req) => {
  guard(req.auth);
  let input;
  try {
    input = checkInput(req.data);
  } catch (err) {
    throw new HttpsError('invalid-argument', err instanceof Error ? err.message : 'Bad input');
  }

  try {
    const res = await gemini().models.generateContent({
      model: GEMINI_MODEL.value(),
      contents: [
        {
          role: 'user',
          parts: [
            { text: buildExtractPrompt(input.mode, input.images.length) },
            ...input.images.map((data) => ({ inlineData: { mimeType: 'image/jpeg', data } })),
          ],
        },
      ],
      config: {
        temperature: 0,
        responseMimeType: 'application/json',
        responseJsonSchema: EXTRACT_SCHEMA,
        httpOptions: { timeout: 100_000 },
      },
    });
    return { pages: parseExtract(res.text ?? '') };
  } catch (err) {
    // The error only: never page text.
    logger.error('extractPage failed', err instanceof Error ? err.message : String(err));
    throw new HttpsError('unavailable', 'Model call failed');
  }
});
