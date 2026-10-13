# legi

Quotes from the books you read. Mostly paper books, sometimes a PDF.
Next.js (static export) + Firebase (Auth + Firestore) + Vercel.
Open it and the last book is there, cursor ready.

Plan, invariants and every decision: [`PLAN-legi.md`](PLAN-legi.md).

| | |
|---|---|
| Live | https://legi.kyphan38.com |
| Firebase project | `kyphan38-legi-app`, database `(default)`, `asia-southeast1` |
| Access | one email - checked on the login screen **and inside `firestore.rules`** |
| Server | none (P5 adds one Cloud Function for photo OCR) |
| Offline | Firestore persistent cache + a localStorage draft on every keystroke |
| Fonts | system only; quote text uses the system serif |

## Run locally

```bash
npm install
# Emulators (Auth + Firestore). Needs Java 21:
PATH=/opt/homebrew/opt/openjdk@21/bin:$PATH npm run emu
# In another terminal:
npm run dev:emu
# Sample data (uid = localStorage 'legi.uid' after an emulator sign-in):
npm run seed -- <uid>
```

Checks: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.

## Stage 0 (owner, on the consoles)

1. Firebase project `kyphan38-legi-app` (Blaze plan, for Functions in P5).
2. Authentication → Google. Authorized domains → `legi.kyphan38.com`.
3. Google Cloud → OAuth client → redirect URI `https://legi.kyphan38.com/__/auth/handler`
   (same iPhone / iPad sign-in fix as the other apps: `vercel.json` proxies `/__/auth/*`).
4. Firestore `(default)` in `asia-southeast1`.
5. Web app config → `.env.local` (see `.env.example`).
6. `npm run rules && firebase deploy --only firestore:rules,firestore:indexes`.
7. Vercel → import the repo, domain `legi.kyphan38.com`, add the `NEXT_PUBLIC_*` variables.
8. DNS: `legi` CNAME as Vercel says.

## How it works

- **Data:** `users/{uid}/books` (sections live inside the book doc),
  `users/{uid}/quotes` (top level, `bookId: null` = Inbox), `users/{uid}/daily/{day}`.
  The app keeps every book and quote in memory (`LibraryContext`), so search,
  duplicate hints and the Daily quote run offline.
- **Writes are never awaited** (`src/lib/repo.ts`): offline, a write goes to
  the cache at once and the save dot stays hollow until the server has it.
- **Vietnamese input:** shortcuts wait for the IME (`isComposing`), text is
  saved as NFC, search ignores marks (`thoi quen` finds `thói quen`), duplicate
  checks keep them (`src/lib/vi.ts`).
- **Delete = Trash for 30 days.** Undo for 5 s (or ⌘Z). The rules only allow a
  hard delete after 30 days; the app purges once a day.

## Composer

- A blank line separates quotes. `Enter` on an empty last line saves; `⌘Enter`
  saves anywhere. Pasting text with blank lines asks `Split into N quotes?`.
- Lines starting with `#`, `##`, `###` in pasted text become sections.
- `p52` (or `tr.52`) at the end sets the page. The page carries over to the next quote.
- `⌘B` wraps the selection in `**emphasis**`, shown in a heavier weight.
- Pasted PDF text is cleaned: hard line breaks joined, `infor-\nmation` fixed,
  page numbers dropped.

## Keys (Mac)

`⌘K` or `/` search and commands · `n` new quote · `j/k` next/prev · `e` edit ·
`f` star · `x` select · `m` move · `⌫` delete · `⌘Z` undo · `[` `]` fold/unfold all ·
`?` all keys.
