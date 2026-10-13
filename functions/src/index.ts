// ============================================================
// legi - Cloud Functions (P5: photo OCR only)
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

setGlobalOptions({ region: 'asia-southeast1', maxInstances: 2 });

const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');
const ALLOWED_USER_EMAIL = defineString('ALLOWED_USER_EMAIL');
const GEMINI_MODEL = defineString('GEMINI_MODEL', { default: 'gemini-3.8-flash' });

let client: GoogleGenAI | null = null;
let clientKey = '';

export const extractPage = onCall({ secrets: [GEMINI_API_KEY], timeoutSeconds: 120, memory: '512MiB' }, async (req) => {
  if (!req.auth || !isAllowed(req.auth.token, ALLOWED_USER_EMAIL.value())) {
    throw new HttpsError('permission-denied', 'Not allowed');
  }
  let input;
  try {
    input = checkInput(req.data);
  } catch (err) {
    throw new HttpsError('invalid-argument', err instanceof Error ? err.message : 'Bad input');
  }

  const key = GEMINI_API_KEY.value();
  if (!client || clientKey !== key) {
    client = new GoogleGenAI({ apiKey: key });
    clientKey = key;
  }
  try {
    const res = await client.models.generateContent({
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
