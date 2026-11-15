// ---------------------------------------------------------------------------
// legi - Check firestore.rules against the running emulator
//
//   npm run emu          # terminal 1 (writes rules for the allowed email)
//   npm run test:rules   # terminal 2
//
// Signs in as the allowed user and as a stranger, then tries reads and writes
// that must pass or fail. Quotes and books leave the trash for good only
// after 30 days there. Test ids start with 'check-' so real test data stays.
// Exits 1 if any check is wrong.
// ---------------------------------------------------------------------------

import { existsSync, readFileSync } from 'node:fs';

import { deleteApp, initializeApp } from 'firebase/app';
import { GoogleAuthProvider, connectAuthEmulator, getAuth, signInWithCredential } from 'firebase/auth';
import { connectFirestoreEmulator, deleteDoc, doc, getDoc, getFirestore, setDoc, setLogLevel } from 'firebase/firestore';

// Denied writes are expected here; the SDK would log each one as an error.
setLogLevel('silent');

// Same email as `npm run rules -- --emu`: .env.local, else the dev email.
function allowedEmail() {
  if (existsSync('.env.local')) {
    const m = readFileSync('.env.local', 'utf8').match(/^\s*ALLOWED_USER_EMAIL\s*=\s*['"]?([^'"\s]+)/m);
    if (m) return m[1].toLowerCase();
  }
  return 'dev@legi.test';
}

const apps = [];

async function client(name, email, verified = true) {
  const app = initializeApp({ apiKey: 'demo-key', projectId: 'demo-legi', appId: 'demo-app' }, name);
  apps.push(app);
  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const db = getFirestore(app);
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  const token = JSON.stringify({ sub: `check-${name}-${email}`, email, email_verified: verified });
  const cred = await signInWithCredential(auth, GoogleAuthProvider.credential(token));
  return { db, uid: cred.user.uid };
}

let failed = 0;
async function expect(label, shouldPass, fn) {
  let ok;
  try {
    await fn();
    ok = true;
  } catch (err) {
    if (err?.code !== 'permission-denied') throw err;
    ok = false;
  }
  const good = ok === shouldPass;
  if (!good) failed++;
  console.log(`${good ? 'ok  ' : 'FAIL'} ${label} (${ok ? 'allowed' : 'denied'})`);
}

const me = await client('me', allowedEmail());
const stranger = await client('stranger', 'someone@example.com');
const mine = (...p) => doc(me.db, 'users', me.uid, ...p);

const DAY_MS = 86_400_000;
// daily docs can only be created once, so each run uses a new day id.
const dailyId = new Date(Date.UTC(1900, 0, 1) + Math.floor(Math.random() * 30000) * DAY_MS).toISOString().slice(0, 10);
const now = Date.now();
const book = {
  title: 'Check book', author: '', status: 'reading', format: 'paper', totalPages: null, currentPage: null,
  pdfUrl: null, takeaway: null, sections: [], startedAt: 1, finishedAt: null, lastOpenedAt: 1, deletedAt: null,
  createdAt: 1, updatedAt: 1,
};
const quote = {
  bookId: 'check-book', sectionId: null, kind: 'quote', text: 'A line worth keeping.', note: '', page: null,
  favorite: false, source: 'typed', answeredBy: null, shownCount: 0, lastShownAt: null, trashedWithBook: false,
  deletedAt: null, createdAt: 1, updatedAt: 1,
};

await expect('owner writes a valid book', true, () => setDoc(mine('books', 'check-book'), book));
await expect('owner writes a valid quote', true, () => setDoc(mine('quotes', 'check-q1'), quote));
await expect('owner reads the quote', true, () => getDoc(mine('quotes', 'check-q1')));
await expect('owner writes an empty quote', false, () => setDoc(mine('quotes', 'check-q1'), { ...quote, text: '' }));
await expect('owner writes an unknown key', false, () => setDoc(mine('quotes', 'check-q1'), { ...quote, tags: [] }));
await expect('owner deletes a live quote', false, () => deleteDoc(mine('quotes', 'check-q1')));

await setDoc(mine('quotes', 'check-q1'), { ...quote, deletedAt: now - 5 * DAY_MS });
await expect('owner deletes a quote 5 days in the trash', false, () => deleteDoc(mine('quotes', 'check-q1')));
await setDoc(mine('quotes', 'check-q1'), { ...quote, deletedAt: now - 31 * DAY_MS });
await expect('owner deletes a quote 31 days in the trash', true, () => deleteDoc(mine('quotes', 'check-q1')));

await expect('owner deletes a live book', false, () => deleteDoc(mine('books', 'check-book')));
await setDoc(mine('books', 'check-book'), { ...book, deletedAt: now - 31 * DAY_MS });
await expect('owner deletes a book 31 days in the trash', true, () => deleteDoc(mine('books', 'check-book')));

await expect('owner writes a daily pick', true, () =>
  setDoc(mine('daily', dailyId), { quoteId: 'check-q1', createdAt: 1 }),
);
await expect('owner changes a daily pick', false, () =>
  setDoc(mine('daily', dailyId), { quoteId: 'check-q2', createdAt: 2 }),
);
await expect('owner writes outside users/', false, () => setDoc(doc(me.db, 'other', 'x'), { a: 1 }));
await expect('owner writes another uid', false, () => setDoc(doc(me.db, 'users', stranger.uid, 'quotes', 'check-q1'), quote));
await expect('stranger writes own quote', false, () =>
  setDoc(doc(stranger.db, 'users', stranger.uid, 'quotes', 'check-q1'), quote),
);
await expect('stranger reads owner book', false, () => getDoc(doc(stranger.db, 'users', me.uid, 'books', 'check-book')));

await Promise.all(apps.map((a) => deleteApp(a)));
console.log(failed ? `\n${failed} check(s) failed` : '\nall rules checks passed');
process.exit(failed ? 1 : 0);
