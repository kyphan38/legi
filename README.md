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
| Server | none for data; two Cloud Functions for AI: `extractPage` (photo OCR) and `transcribe` (voice) |
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

Functions: `npm run fn:env`, then `firebase deploy --only functions`. The key lives in
Secret Manager (`firebase functions:secrets:set GEMINI_API_KEY`).

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
- The mic button records (tap to start, tap to stop, 2 min max) and writes
  the words into the composer. Say "xuống dòng" / "đoạn mới" for a line / paragraph.
- `->` becomes →, `=>` becomes ⇒.
- `⌘B` wraps the selection in `**emphasis**`, shown in a heavier weight.
- Pasted PDF text is cleaned: hard line breaks joined, `infor-\nmation` fixed,
  page numbers dropped.

## Keys (Mac)

`⌘K` or `/` search and commands · `n` new quote · `j/k` next/prev · `e` edit ·
`f` star · `x` select · `m` move · `⌫` delete · `⌘Z` undo · `[` `]` fold/unfold all ·
`?` all keys.

## Motion

Small and quiet (`PLAN-motion.md`, `ws/app/DESIGN.md` "Motion"). Classes are in
`src/app/globals.css`: `rise`, `fade-in`, `sheet-up`, `flash`, `settle` (older)
and `fade-out`, `sheet-down`, `row-out`, `breathe` (new), on `--ease-soft`. The
last block turns every animation off under `prefers-reduced-motion`; the
typewriter and the first-rows `rise` on opening a book already respected it.

- `src/lib/motion.ts` (`reducedMotion`, `leavingItems`, tested) and
  `src/hooks/usePresence.ts` (keeps a thing mounted while it leaves) are
  copied from logi. Old `matchMedia` checks in `Typewriter`, `BookView` and
  `useQuoteBoard` were left as they are.
- The recording dot in `VoiceButton` fades slowly (`breathe`) instead of
  pulsing.
- `UndoBar` fades out after its 5 seconds and after a press on `undo` (the last
  entry stays on screen for the fade, and a leaving bar takes no taps). A new
  entry shows at once.
- `Sheet` (one component for every sheet) now slides out before it unmounts:
  Esc, a tap outside and, on a phone, a swipe down from the handle at the top
  all close it. Because `open` belongs to the parent, every close slides out,
  buttons inside included (200ms, the sheet is `inert` meanwhile). The content of
  the last open frame stays on screen while it leaves (`frozen`), so a menu that
  clears its data on close (`QuoteMenu`) does not show an empty panel. Page
  scroll is locked by a counter, so a sheet that opens while another slides out
  keeps it locked.
- `CommandPalette` slides out on Esc or a tap outside; running a command closes
  it at once. `CropView` fades out on cancel; `use` closes it at once.

