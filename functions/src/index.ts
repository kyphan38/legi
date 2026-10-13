// ============================================================
// legi - Cloud Functions: photo OCR and voice to text
//
// The site stays a static export. This function exists because the Gemini
// key must not reach the browser. It checks the same email as
// firestore.rules, keeps nothing (no images, no text) and logs no content.
// ============================================================

import { GoogleGenAI } from '@google/genai';
import { setGlobalOptions } from 'firebase-functions';
import { HttpsError, onCall } from 'firebase-functions/https';
import { logger } from 'firebase-functions';
import { defineSecret, defineString } from 'firebase-functions/params';

import { isAllowed } from './access.ts';
import { buildExtractPrompt, checkInput, EXTRACT_SCHEMA, parseExtract } from './extract.ts';
import { checkVoice, parseVoice, VOICE_PROMPT, VOICE_SCHEMA } from './voice.ts';

setGlobalOptions({ region: 'asia-southeast1', maxInstances: 2 });

const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');
const ALLOWED_USER_EMAIL = defineString('ALLOWED_USER_EMAIL');
const GEMINI_MODEL = defineString('GEMINI_MODEL', { default: 'gemini-4-argon' });

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
