// ---------------------------------------------------------------------------
// legi - Write env files for Cloud Functions from .env.local
//
//   npm run fn:env
//
// functions/.env           ALLOWED_USER_EMAIL, GEMINI_MODEL, TTS_QUOTA_PROJECT: deploy and emulator
// functions/.secret.local  emulator only: GEMINI_API_KEY
//
// The emulator uses the same email as `npm run rules -- --emu`, so the fake
// Google sign-in passes both the rules and the functions.
// On deploy the key comes from Secret Manager, set once with:
//   firebase functions:secrets:set GEMINI_API_KEY
// Both files are gitignored.
// ---------------------------------------------------------------------------

import { existsSync, readFileSync, writeFileSync } from 'node:fs';

function readEnvFile(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
  return out;
}

const env = { ...readEnvFile('.env.local'), ...process.env };
const email = (env.ALLOWED_USER_EMAIL ?? '').trim().toLowerCase();
const key = (env.GEMINI_API_KEY ?? '').trim();

if (!email) {
  console.error('ALLOWED_USER_EMAIL is missing in .env.local.');
  process.exit(1);
}

const lines = [`ALLOWED_USER_EMAIL=${email}`];
// Always written: non-interactive deploy fails on a param with no value, even with a default.
lines.push(`GEMINI_MODEL=${(env.GEMINI_MODEL ?? '').trim() || 'gemini-4-argon'}`);
// Text-to-Speech is billed to the same project as the anki skill (GOOGLE_TTS_PROJECT).
lines.push(`TTS_QUOTA_PROJECT=${(env.TTS_QUOTA_PROJECT ?? env.GOOGLE_TTS_PROJECT ?? '').trim()}`);
writeFileSync('functions/.env', lines.join('\n') + '\n');
console.log('functions/.env written');

if (key) {
  writeFileSync('functions/.secret.local', `GEMINI_API_KEY=${key}\n`);
  console.log('functions/.secret.local written (emulator only)');
} else {
  console.log('GEMINI_API_KEY not in .env.local: the emulator cannot call Gemini.');
}
