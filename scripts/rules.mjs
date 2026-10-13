// ---------------------------------------------------------------------------
// legi - Build firestore.rules from firestore.rules.template
//
//   npm run rules            # reads ALLOWED_USER_EMAIL from .env.local / env
//   npm run rules -- --emu   # emulator: falls back to dev@legi.test
//
// Then deploy:  firebase deploy --only firestore:rules
//
// Why not write the email into the rules: the repo may be public, and the
// generated file is in .gitignore.
// ---------------------------------------------------------------------------

import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const EMU = process.argv.includes('--emu');
const DEV_EMAIL = 'dev@legi.test';

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
let email = (env.ALLOWED_USER_EMAIL ?? '').trim().toLowerCase();

if (!email && EMU) email = DEV_EMAIL;
if (!email) {
  console.error('ALLOWED_USER_EMAIL is missing. Set it in .env.local (see .env.example).');
  process.exit(1);
}
if (!/^[^\s'"\\@]+@[^\s'"\\@]+$/.test(email)) {
  console.error(`ALLOWED_USER_EMAIL does not look like an email: ${email}`);
  process.exit(1);
}

const template = readFileSync('firestore.rules.template', 'utf8');
writeFileSync('firestore.rules', template.replaceAll('__ALLOWED_USER_EMAIL__', email));
console.log(`firestore.rules written for ${email}`);
