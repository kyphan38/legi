# legi - Implementation plan

App lưu trích dẫn khi đọc sách. Chủ yếu sách giấy, đôi khi PDF.
Next.js (static export) + Firebase (Auth + Firestore + 1 Cloud Function cho AI ở P5) + Vercel.
Một người dùng, iPhone (PWA) là chính, Mac là màn hình thứ hai.
**Giao diện tiếng Anh, nội dung gõ tiếng Việt.**

Plan này viết cho agent code (Sonnet). Làm đúng thứ tự phase. Mỗi phase có:
mục tiêu, file cần tạo, hành vi chính xác, test, tiêu chí "done".
Không tự thêm tính năng ngoài plan. Ý mới ghi vào mục "Để sau" ở cuối file.

---

## 0. Đọc trước khi code

1. `../AGENTS.md` (luật chung: không em dash, không co-author, code/comment tiếng Anh, UI copy tối thiểu).
2. `../DESIGN.md` (chỉ đen/trắng/xám, token màu, Theme row).
3. `../hodi/README.md` và `../hodi/roadmap/ROADMAP.md`. legi copy khung của hodi.
4. Next.js trong repo này là bản mới (16.x). Trước khi viết code liên quan Next, đọc
   `node_modules/next/dist/docs/` như `AGENTS.md` của hodi dặn.

### File hodi được copy (rồi đổi `hodi` → `legi`)

| File hodi | Dùng lại thế nào |
|---|---|
| `next.config.ts`, `vercel.json`, `postcss.config.mjs`, `eslint.config.mjs`, `tsconfig.json` | Copy nguyên, đổi project id trong `vercel.json` |
| `firebase.json`, `.firebaserc`, `.env.example`, `.gitignore` | Copy, đổi project thành `kyphan38-legi-app` |
| `scripts/rules.mjs`, `scripts/make-icons.mjs`, `scripts/functions-env.mjs` (P5), `scripts/seed-emu.mjs` | Copy, đổi tên. Seed viết lại cho dữ liệu sách |
| `src/lib/firebase-client.ts` | Copy nguyên (lazy init, persistent cache, authDomain theo domain riêng) |
| `src/lib/store.ts` | Copy nguyên. Đổi tên `clearHodiStorage` → `clearLegiStorage`, prefix `legi.` |
| `src/lib/prefs.ts` | Copy, đổi key `legi.theme`, `legi.size`, thêm `typewriterStore`, `shelfViewStore` |
| `src/lib/sw.ts`, `public/sw.js`, `src/components/ServiceWorkerRegistrar.tsx` | Copy, đổi `CACHE_VERSION = 'legi-v1'` và danh sách `PAGES` |
| `src/lib/auth/allowed-user.ts`, `src/contexts/AuthContext.tsx`, `src/components/AuthGate.tsx`, `src/components/LoginView.tsx`, `src/app/login/page.tsx` | Copy, đổi tên |
| `src/lib/day.ts` | Chỉ lấy `dayOf()` (ngày bắt đầu 04:00), `isDayId`, `addDays`, `diffDays`, `monthDay` |
| `src/lib/draft.ts` | Copy, đổi `PREFIX = 'legi.draft.'` |
| `src/hooks/useSaveOnLeave.ts` | Copy nguyên |
| `src/components/GrowText.tsx` + class `.grow` trong `globals.css` | Copy nguyên (textarea tự cao, không nhảy trang) |
| `src/components/StatusDot.tsx` | Copy, bỏ phần đếm chữ |
| `test/register.mjs`, `test/alias-hook.mjs` | Copy nguyên |
| `functions/` (chỉ ở P5) | Copy `access.ts`, `gemini.ts`, khung `index.ts` (`guard()`) |

Không copy: `JournalContext`, `usePage`, mọi thứ về AI, review, heatmap, questions của hodi.

### Thư viện

Chỉ dùng: `next`, `react`, `react-dom`, `firebase`, `tailwindcss`, `sharp` (dev, làm icon).
**Không thêm thư viện khác** (không UI kit, không drag-drop lib, không fuzzy-search lib,
không idb lib). Mọi thứ trong plan đều viết được bằng code thuần.

---

## 1. Nguyên tắc bất biến (mọi phase)

Không được đổi nếu chưa hỏi chủ app.

1. **Mở app là gõ được ngay.** `/` mở cuốn sách gần nhất, con trỏ đã nằm trong ô nhập.
   Ngoại lệ duy nhất: lần mở đầu tiên mỗi ngày thì hiện Daily quote trước (P3).
2. **Không bao giờ mất chữ.** Nháp localStorage mỗi phím gõ + Firestore persistent cache.
   Xoá là xoá mềm: vào Trash 30 ngày, có Undo.
3. **Không bao giờ `await` một lệnh ghi Firestore trong luồng UI.** Khi offline, promise
   chỉ xong khi có mạng. Gọi `setDoc/updateDoc/writeBatch().commit()` rồi đi tiếp. Trạng thái
   lưu đọc từ `snapshot.metadata.hasPendingWrites` và hiện bằng StatusDot.
4. **Chữ tiếng Việt phải đúng.** Mọi chữ lưu xuống đều là NFC. Phím tắt không chạy khi bộ gõ
   đang composing. Xem mục 4.
5. **Chỉ xám.** Theo DESIGN.md. Ý nghĩa thể hiện bằng độ đậm và chữ, không bằng màu.
   Không emoji. Icon là SVG một nét, `currentColor`.
6. **Yên lặng.** Không toast, không popup, không thông báo đẩy, không streak, không huy hiệu.
   Ngoại lệ duy nhất: dòng `Deleted · undo` ở dưới màn hình trong 5 giây sau thao tác xoá/gộp/chuyển.
7. **AI chỉ giúp nhập liệu** (OCR, tách chữ). AI không viết thought, không tóm tắt sách.
8. **Không server, trừ AI.** Site là static export. Bảo vệ dữ liệu = Firestore rules kiểm
   cả uid và email. Cloud Function (P5) kiểm cùng email.
9. **Tiêu đề tab luôn là `legi`.** Không trang nào tự đặt title.
10. **UI copy tối thiểu.** Nút là 1-2 chữ thường, ví dụ `save`, `move`, `undo`. Không câu giải thích.

---

## 2. Hạ tầng

| | |
|---|---|
| Firebase project | `kyphan38-legi-app` |
| Firestore | database `(default)`, `asia-southeast1` |
| Auth | Google, chỉ 1 email (`ALLOWED_USER_EMAIL`) |
| Domain | `legi.kyphan38.com` (Vercel) |
| Functions (P5) | `asia-southeast1`, Node 24, secret `GEMINI_API_KEY`, model mặc định giống hodi |
| Emulator project | `demo-legi`, email dev `dev@legi.test` |

### Stage 0 (chủ app tự làm trên console, agent chỉ viết hướng dẫn vào README)

1. Firebase Console → tạo project `kyphan38-legi-app` (gói Blaze, cần cho Functions ở P5).
2. Authentication → bật Google. Authorized domains → thêm `legi.kyphan38.com`.
3. Google Cloud Console → OAuth client của project → thêm redirect URI
   `https://legi.kyphan38.com/__/auth/handler` (cách sửa lỗi đăng nhập trên iPhone/iPad, giống các app khác).
4. Firestore → tạo `(default)` ở `asia-southeast1`.
5. Project settings → Web app → chép config vào `.env.local`.
6. `npm run rules && firebase deploy --only firestore:rules,firestore:indexes`.
7. Vercel → import repo, domain `legi.kyphan38.com`, thêm biến `NEXT_PUBLIC_*`.
8. DNS: `legi` CNAME theo hướng dẫn của Vercel (giống các subdomain khác).

---

## 3. Mô hình dữ liệu

Tất cả nằm dưới `users/{uid}/`. Thời gian là epoch ms (`number`, kiểu `int` trong rules).

```ts
// src/types/legi.ts

export type BookStatus = 'reading' | 'finished' | 'later';
export type BookFormat = 'paper' | 'pdf';
export type QuoteKind = 'quote' | 'thought' | 'question'; // 'question' chỉ có UI từ P5
export type QuoteSource = 'typed' | 'paste' | 'ocr';

export type Section = {
  id: string;            // 8 ký tự ngẫu nhiên [a-z0-9]
  title: string;         // <= 200
  parentId: string | null;
  order: number;         // thứ tự giữa các anh em, số thực (chèn giữa = trung bình 2 số)
};

// users/{uid}/books/{bookId}
export type Book = {
  title: string;               // 1..300
  author: string;              // 0..200
  status: BookStatus;
  format: BookFormat;
  totalPages: number | null;   // 1..20000
  currentPage: number | null;  // trang đang đọc tới
  pdfUrl: string | null;       // chỉ là link, không lưu file
  takeaway: string | null;     // câu trả lời "What stays with you?" (P4), <= 2000
  sections: Section[];         // <= 500 phần tử, lưu ngay trong doc sách
  startedAt: number;
  finishedAt: number | null;
  lastOpenedAt: number;
  deletedAt: number | null;
  createdAt: number;
  updatedAt: number;
};

// users/{uid}/quotes/{quoteId}   (cấp trên, không lồng trong book)
export type Quote = {
  bookId: string | null;       // null = Inbox
  sectionId: string | null;    // null = đầu sách, chưa có chương
  kind: QuoteKind;
  text: string;                // 1..5000, NFC, có thể chứa **nhấn mạnh**
  note: string;                // 0..5000, suy nghĩ riêng gắn với quote
  page: number | null;         // 1..20000
  favorite: boolean;
  source: QuoteSource;
  answeredBy: string | null;   // chỉ dùng cho kind 'question' (P5)
  shownCount: number;          // số lần làm Daily quote
  lastShownAt: number | null;
  trashedWithBook: boolean;    // true nếu vào Trash vì cả cuốn sách bị xoá
  deletedAt: number | null;
  createdAt: number;
  updatedAt: number;
};

// users/{uid}/daily/{YYYY-MM-DD}   (ngày theo dayOf(), bắt đầu 04:00)
export type DailyPick = { quoteId: string; createdAt: number };
```

**Vì sao `sections` nằm trong doc sách:** một cuốn sách có vài chục mục. Lưu chung thì đổi
thứ tự, thụt lề, đổi tên đều là 1 lần ghi, không bao giờ lệch nhau.

**Vì sao không lưu các bản text đã chuẩn hoá:** app đọc toàn bộ quotes vào bộ nhớ (xem 5.1),
nên tính lúc chạy là đủ nhanh. Schema gọn hơn, không bao giờ lệch.

**Thứ tự quote trong một section:** `page` tăng dần (null xếp cuối), rồi `createdAt` tăng dần.
Không có kéo thả sắp xếp tay.

### Firestore rules (`firestore.rules.template`)

Copy khung từ hodi (`allowed()`, `isOwner()`, chặn `/{document=**}`). Khác hodi:

```
function validBook(d) {
  return d.keys().hasOnly(['title','author','status','format','totalPages','currentPage',
      'pdfUrl','takeaway','sections','startedAt','finishedAt','lastOpenedAt','deletedAt',
      'createdAt','updatedAt'])
    && d.title is string && d.title.size() > 0 && d.title.size() <= 300
    && d.author is string && d.author.size() <= 200
    && d.status in ['reading','finished','later']
    && d.format in ['paper','pdf']
    && (d.totalPages == null || (d.totalPages is int && d.totalPages > 0 && d.totalPages <= 20000))
    && (d.currentPage == null || (d.currentPage is int && d.currentPage > 0 && d.currentPage <= 20000))
    && (d.pdfUrl == null || (d.pdfUrl is string && d.pdfUrl.size() <= 2000))
    && (d.takeaway == null || (d.takeaway is string && d.takeaway.size() <= 2000))
    && d.sections is list && d.sections.size() <= 500
    && d.startedAt is int && d.lastOpenedAt is int
    && (d.finishedAt == null || d.finishedAt is int)
    && (d.deletedAt == null || d.deletedAt is int)
    && d.createdAt is int && d.updatedAt is int;
}

function validQuote(d) {
  return d.keys().hasOnly(['bookId','sectionId','kind','text','note','page','favorite','source',
      'answeredBy','shownCount','lastShownAt','trashedWithBook','deletedAt','createdAt','updatedAt'])
    && (d.bookId == null || d.bookId is string)
    && (d.sectionId == null || d.sectionId is string)
    && d.kind in ['quote','thought','question']
    && d.text is string && d.text.size() > 0 && d.text.size() <= 5000
    && d.note is string && d.note.size() <= 5000
    && (d.page == null || (d.page is int && d.page > 0 && d.page <= 20000))
    && d.favorite is bool
    && d.source in ['typed','paste','ocr']
    && (d.answeredBy == null || d.answeredBy is string)
    && d.shownCount is int && d.shownCount >= 0
    && (d.lastShownAt == null || d.lastShownAt is int)
    && d.trashedWithBook is bool
    && (d.deletedAt == null || d.deletedAt is int)
    && d.createdAt is int && d.updatedAt is int;
}

// Hard delete only for items in Trash for more than 30 days.
function purgeable() {
  return resource.data.deletedAt is int
    && request.time.toMillis() - resource.data.deletedAt > 2592000000;
}

match /users/{uid}/books/{id} {
  allow read: if isOwner(uid);
  allow create, update: if isOwner(uid) && validBook(request.resource.data);
  allow delete: if isOwner(uid) && purgeable();
}
match /users/{uid}/quotes/{id} {
  allow read: if isOwner(uid);
  allow create, update: if isOwner(uid) && validQuote(request.resource.data);
  allow delete: if isOwner(uid) && purgeable();
}
// First device to pick the day's quote wins; never changed after.
match /users/{uid}/daily/{day} {
  allow read: if isOwner(uid);
  allow create: if isOwner(uid)
    && day.matches('^[0-9]{4}-[0-9]{2}-[0-9]{2}$')
    && request.resource.data.keys().hasOnly(['quoteId','createdAt'])
    && request.resource.data.quoteId is string
    && request.resource.data.createdAt is int;
  allow update, delete: if false;
}
```

`firestore.indexes.json`: không cần index (app đọc cả collection).

---

## 4. Tiếng Việt: luật xử lý chữ

Tất cả nằm trong các file **thuần** (không DOM, không Firestore) để test bằng `node:test`.

### 4.1 `src/lib/vi.ts`

```ts
export function nfc(s: string): string;                 // s.normalize('NFC')
export function fold(s: string): string;                // bỏ dấu để tìm kiếm
export function foldWithMap(s: string): { folded: string; map: number[] };
export function dupKey(s: string): string;              // chuẩn hoá để so trùng (GIỮ dấu)
export function graphemes(s: string): string[];         // tách theo chữ nhìn thấy
export function looksBroken(s: string): boolean;        // PDF bảng mã cũ
export const viCollator: Intl.Collator;                 // new Intl.Collator('vi', { sensitivity: 'base' })
```

- `fold`: `NFD` → bỏ ký tự `\p{M}` → `đ→d`, `Đ→D` → lowercase → gộp khoảng trắng → bỏ `**`.
- `foldWithMap`: fold **từng grapheme** một, ghi lại vị trí grapheme gốc cho mỗi ký tự sau fold.
  Dùng để tô đậm đúng chỗ khớp trong kết quả tìm kiếm.
- `dupKey`: NFC → lowercase → bỏ `**` → bỏ dấu câu (`\p{P}` và `\p{S}`) → gộp khoảng trắng → trim.
  **Không bỏ dấu tiếng Việt** ("ma" khác "má").
- `graphemes`: `Intl.Segmenter('vi', { granularity: 'grapheme' })`; nếu không có thì `Array.from`.
- `looksBroken`: true nếu (a) sau NFC vẫn còn ký tự `\p{M}` đứng riêng, hoặc
  (b) hơn 5% ký tự thuộc tập ký tự hay gặp trong TCVN3/VNI bị đọc sai:
  `¸µ¶·¹¨©ª«¬®¯°±²³´½¾ÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖ×ØÙÚÛÜÝÞßøù`, và chữ không có dấu tiếng Việt chuẩn nào.

Test (`test/vi.test.ts`), tối thiểu:
- `fold('Thói Quen')` = `'thoi quen'`; `fold('Đường đi')` = `'duong di'`.
- `nfc('e\u0302\u0323')` = `'ệ'`; `dupKey` của bản NFD và NFC bằng nhau.
- `dupKey('Ma.')` ≠ `dupKey('má')`.
- `graphemes('ệ')` có độ dài 1 kể cả khi input là NFD.
- `foldWithMap('Người ở')`: tìm `'nguoi'` tô đúng 5 grapheme đầu.
- `looksBroken('Ng\u00ADêi ë l¹i')` = true; `looksBroken('Người ở lại')` = false.
- `viCollator` xếp `['Đen','Dao','Em']` thành `['Dao','Đen','Em']`.

### 4.2 `src/lib/typo.ts` (chỉ chạy khi lưu, không chạy lúc đang gõ, vì sẽ làm nhảy con trỏ)

```ts
export function tidy(s: string): string;
```
Thứ tự: NFC → `\r\n`→`\n` → bỏ soft hyphen `\u00AD` → `...`→`…` → `"` thẳng thành `“ ”`
(mở nếu đứng đầu hoặc sau khoảng trắng/`(`, còn lại là đóng) → `'` giữa 2 chữ cái thành `’` →
gộp nhiều dấu cách trong một dòng → bỏ khoảng trắng cuối mỗi dòng → bỏ dòng trống ở đầu và cuối.
**Không** tự viết hoa, không sửa chính tả.

### 4.3 `src/lib/page-token.ts`

```ts
export function takePageToken(s: string): { text: string; page: number | null };
```
Nếu chữ kết thúc bằng `p52`, `p.52`, `p 52`, `tr52`, `tr.52` (không phân biệt hoa thường,
có khoảng trắng phía trước) thì tách ra thành số trang và bỏ khỏi chữ. Chỉ xét ở **cuối** chữ.
Test: `'Câu hay p52'` → `{text:'Câu hay', page:52}`; `'help52'` → không đổi; `'p0'` → không đổi.

### 4.4 Ô nhập (áp dụng cho mọi textarea gõ nội dung)

- `lang="vi"`, `spellCheck={false}`, `autoCapitalize="sentences"`, `autoComplete="off"`.
- Font chữ trong ô nhập ≥ 16px (iOS không tự zoom).
- **Mọi phím tắt** (Enter để chốt, ⌘Enter, Tab, Esc, j/k...) kiểm tra trước:
  `if (e.nativeEvent.isComposing || e.keyCode === 229) return;`
- Ô tên sách, tác giả để `lang` mặc định (tên sách có thể là tiếng Anh).
- Phím tắt một chữ (`j`, `k`, `e`, `f`, `n`, `/`...) **không chạy** khi focus đang ở input/textarea/contenteditable.

---

## 5. Kiến trúc client

### 5.1 Dữ liệu trong bộ nhớ: `src/contexts/LibraryContext.tsx`

- Một `onSnapshot` cho `users/{uid}/books`, một cho `users/{uid}/quotes`, cả hai với
  `{ includeMetadataChanges: true }`. Cache-first nhờ persistent cache.
- Cung cấp: `books: Map<id, Book>`, `quotes: Map<id, Quote>`, `byBook: Map<bookId|null, Quote[]>`
  (đã sắp xếp, đã bỏ quote trong Trash), `counts`, `pending: boolean` (có lệnh ghi chưa lên server),
  `loaded: boolean`.
- Ước lượng: 5.000 quote × ~400 byte = 2MB. Chấp nhận được. Ghi chú trong code: xem lại khi > 10.000.

### 5.2 Ghi dữ liệu: `src/lib/repo.ts`

Mọi hàm **không trả về promise cho UI chờ** (nguyên tắc 3). Gom nhiều doc thì dùng `writeBatch`.

```ts
createBook(uid, title): string                      // trả về id, status 'reading'
updateBook(uid, id, patch: Partial<Book>): void
trashBook(uid, id): void        // book.deletedAt + mọi quote của nó deletedAt cùng giờ, trashedWithBook=true
restoreBook(uid, id): void      // ngược lại, chỉ khôi phục quote có trashedWithBook=true và cùng deletedAt
createQuote(uid, input): string
updateQuote(uid, id, patch): void
trashQuotes(uid, ids): void
restoreQuotes(uid, ids): void
moveQuotes(uid, ids, bookId, sectionId): void
mergeQuotes(uid, ids): void     // xem P2
splitQuote(uid, id, at: number): void   // xem P2
purgeTrash(uid, books, quotes): void    // xoá hẳn đồ quá 30 ngày; chạy 1 lần khi mở app, tối đa 1 lần/ngày
saveDaily(uid, day, quoteId): void      // P3
```

Mỗi thao tác xoá/chuyển/gộp/tách đẩy một mục vào **undo stack** (`src/lib/undo.ts`, chỉ trong RAM,
tối đa 20 mục). Mỗi mục có `label` (`Deleted`, `Moved`, `Merged`, `Split`) và hàm `revert()`.

### 5.3 Các hàm thuần khác (đều có test)

| File | Nội dung |
|---|---|
| `src/lib/outline.ts` | `buildTree(sections)`, `pathOf(sections, id)`, `indent/outdent/moveUp/moveDown`, `addSection`, `removeSection` (quote chuyển lên mục cha), `parseToc(text)` |
| `src/lib/order.ts` | `sortQuotes(quotes)`, `orderBetween(a, b)` |
| `src/lib/paste.ts` | `cleanPaste(raw)`, `splitBlocks(text)` (P1 bản đơn giản, P4 bản đầy đủ) |
| `src/lib/dup.ts` | `trigrams`, `dice`, `findSimilar(text, quotes, excludeId?)` (P4) |
| `src/lib/daily.ts` | `pickDaily(...)`, `onThisDay(...)`, `revisitBoost(...)` (P3, P5) |
| `src/lib/search.ts` | `searchAll(query, books, quotes)` (P3) |
| `src/lib/export.ts` | `toMarkdown(books, quotes)`, `bookToMarkdown(book, quotes)`, `toJson(...)` (P3) |
| `src/lib/emph.ts` | `parseEmph(text): Array<{text, strong}>`, `toggleEmph(text, start, end)` (P3) |

### 5.4 Routes (static export: tham số đi bằng query string, giống hodi)

| Route | Nội dung | Phase |
|---|---|---|
| `/` | Điều hướng: lần đầu trong ngày → Daily; còn lại → `/book/?id=<last>`; chưa có sách → `/shelf/` | P1 (Daily từ P3) |
| `/shelf/` | Kệ sách + dạng list + `+ book` + `Inbox 7` | P1 (list), P3 (kệ) |
| `/book/?id=` | Trang sách: header, quotes theo mục, thanh soạn thảo | P1 |
| `/inbox/` | Quote chưa có sách | P2 |
| `/slow/?id=&from=` | Read slowly | P4 |
| `/search/` | Tìm kiếm (mobile); desktop dùng ⌘K | P3 |
| `/trash/` | Thùng rác 30 ngày | P1 |
| `/settings/` | Theme, Text size, Typewriter, Export, Trash, Sign out | P1 (Export P3) |
| `/capture/?book=` | Duyệt kết quả OCR | P5 |
| `/questions/` | Câu hỏi đang mở | P5 |
| `/login/` | Copy từ hodi | P0 |

`?new=1` trên `/` → mở sách gần nhất và focus ô nhập (dùng cho iOS Shortcut và app shortcut).

### 5.5 localStorage (theo máy)

`legi.theme`, `legi.size`, `legi.typewriter` (`on|off`, mặc định `on`), `legi.shelfView`
(`shelf|list`), `legi.last` (bookId), `legi.scroll.<bookId>` (vị trí cuộn),
`legi.fold.<bookId>` (danh sách section đang đóng), `legi.ctx.<bookId>` (section đang chọn
trong ô nhập), `legi.draft.<uid>/<bookId|inbox>` (nháp ô nhập), `legi.dailySeen` (ngày đã xem Daily),
`legi.purgedAt` (ngày chạy purge gần nhất).

---

## 6. Giao diện

### 6.1 Token

Copy token màu và theme từ `hodi/src/app/globals.css` (đúng bảng DESIGN.md). Thêm:

```css
:root {
  --serif: ui-serif, "New York", "Noto Serif", Georgia, serif;   /* chỉ cho nội dung quote */
  --sans: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
  --quote-size: 19px;            /* S 17px, M 19px, L 21px */
  --ui-size: 15px;
  --ease: cubic-bezier(.2,.8,.2,1);
  /* Spine shades: light steps carry ink text, dark steps carry bg text. */
  --spine-1: #d4d4d4; --spine-2: #b0b0b0; --spine-3: #636363; --spine-4: #3d3d3d;
}
/* dark: --spine-1: #3a3a3a; --spine-2: #525252; --spine-3: #9a9a9a; --spine-4: #c4c4c4; */
```

- Phần còn lại của UI dùng `--sans`. Chỉ `text` của quote kind `quote` dùng `--serif`.
- `.quote-text { font-family: var(--serif); font-size: var(--quote-size); line-height: 1.75; }`
- Cột chữ `max-width: 36rem`, căn giữa, lề 20px trên mobile (giống `.paper` của hodi).
- Trong P0, thêm 1 dòng vào `../DESIGN.md`, mục ngoại lệ: legi dùng font serif hệ thống cho nội
  dung quote (chủ app đồng ý ngày 2026-10-13). Không có màu nào khác.

### 6.2 Chuyển động

- Chỉ đổi `opacity` và `transform`. 150-250ms, `var(--ease)`. Không bounce.
- Mở trang sách: 12 quote đầu tiên hiện dần (`opacity 0→1`, `translateY 4px→0`, 220ms,
  mỗi cái trễ 25ms). Các quote sau hiện ngay.
- Bottom sheet: trượt lên 220ms.
- `@media (prefers-reduced-motion: reduce)`: tắt hết animation và typewriter.

### 6.3 Thanh trên cùng (`TopBar`)

Một dòng chữ nhỏ màu `faint`: bên trái `shelf` (hoặc tên sách khi cuộn qua header), bên phải
`search · settings`. Mờ dần khi đang gõ trong ô nhập (giống hodi). StatusDot ở góc dưới phải.

### 6.4 Trang sách `/book/?id=`

```
shelf                                     search · settings

Atomic Habits
James Clear
p. 142 / 320  ─────────────────░░░░░░░   stopped at

  (quote chưa có chương, nếu có)

Chapter 3  The Habit Loop
  3.2  Cue                                         4

     “Thói quen là lời giải cho những vấn đề
     lặp đi lặp lại trong cuộc sống.”          52

     Bạn không vươn lên bằng mục tiêu...       54
        ghi chú của bạn, chữ nhỏ, màu muted

─────────────────────────────────────────────────
Ch 3 › 3.2 Cue                       p. [ 54 ]
Type a quote...
quote | thought        + note        B         save
```

- Heading cấp 1: sans 15px, `font-medium`, `ink`. Cấp 2: sans 14px, `muted`. Cấp 3+: sans 13px, `faint`, thụt 12px mỗi cấp.
- Quote kind `quote`: serif. Kind `thought`: sans, màu `muted`, cùng cỡ chữ quote trừ 1px.
- Số trang: lề phải, `faint`, `tabular-nums`, 12px.
- Note: thụt 16px, sans 14px, `muted`.
- **Dấu ngoặc treo:** nếu chữ bắt đầu bằng `“` hoặc `"`, bọc ký tự đó trong `<span class="hang">`
  với `margin-left: -0.42em`.
- Quote yêu thích: một dấu sao nhỏ một nét (SVG) màu `faint` ở cạnh số trang. Không đổi màu chữ.
- Khoảng cách giữa 2 quote: 28px. Không bullet, không khung, không đường kẻ.

### 6.5 Icon

`public/branding/legi-icon.svg`, đúng format chung (ô `#f4f4f1`, viền `#dcdcd6`, nét `#141414`),
giống cấu trúc `hodi-icon.svg`. Hình: 3 gáy sách đứng và 1 cuốn nghiêng trên một kệ.

```svg
<g transform="translate(22 22) scale(3.5)" fill="none" stroke="#141414" stroke-width="2.4"
   stroke-linecap="round" stroke-linejoin="round">
  <path d="M3 20.5h18"/>
  <path d="M6 20.5V8"/>
  <path d="M10 20.5V5"/>
  <path d="M14 20.5V9.5"/>
  <path d="M16.8 20.5l3.2-10.5"/>
</g>
```
Sau đó `npm run icons`. Trong hub dùng cùng SVG này.

---

## 7. Các phase

Mỗi phase làm trên branch riêng: `feat/p0-skeleton`, `feat/p1-capture`, ...
Commit theo kiểu của hodi: `feat(scope): ...`, `fix(scope): ...`. Không co-author.
Trước mỗi commit: kiểm tra đang ở đúng branch, `git add` từng đường dẫn cụ thể (có thể có
session AI khác làm việc cùng lúc trong workspace).

**Done của mọi phase:** `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` đều qua.
Chạy thử trên emulator (`npm run emu` + `npm run dev:emu`) theo checklist của phase.
Cập nhật README (mục tính năng) và bảng "Nhật ký quyết định" ở cuối file này.
**Hỏi chủ app trước khi merge vào `main` và deploy.**

---

### P0 - Khung

Mục tiêu: đăng nhập được, có trang trống, offline mở được, theme đúng.

1. Không chạy `create-next-app`. Thư mục `legi/` đã có (chứa file plan này). Copy file từ hodi
   theo bảng ở mục 0, rồi `git init`, branch `main`.
2. `package.json`: copy từ hodi, đổi `name`, đổi `demo-hodi` → `demo-legi` trong script `emu`,
   bỏ `fn:*` cho tới P5. Giữ đúng phiên bản `next 16.3.4`, `react 19.2.8`, `firebase ^12.18.0`.
3. Đổi mọi chữ `hodi` → `legi` (key localStorage, cache SW, metadata, manifest, email dev).
4. `src/app/layout.tsx`: `title: 'legi'`, `description: 'Quotes from the books you read'`.
   Bỏ `PrivacyVeil`.
5. `manifest.ts`: name `legi`, `start_url: '/'`, thêm
   `shortcuts: [{ name: 'New quote', url: '/?new=1' }]`.
6. `public/sw.js`: `PAGES = ['/', '/shelf/', '/book/', '/inbox/', '/slow/', '/search/', '/trash/', '/settings/', '/login/']`.
   (Trang chưa có ở P0 thì tạo file page trống trả về `null`, để precache không lỗi.)
7. `firestore.rules.template` theo mục 3. `scripts/rules.mjs` copy.
8. Icon theo 6.5. `npm run icons`.
9. Token CSS theo 6.1. Thêm dòng ngoại lệ serif vào `../DESIGN.md`.
10. `src/app/(main)/layout.tsx`: `AuthGate` + `LibraryProvider` (P0 chỉ cần khung rỗng) + `TopBar`.
11. `/settings/`: Theme (`system · light · dark`), Text size (`s · m · l`), Sign out. Copy giao diện
    `SettingsView` của hodi, bỏ các dòng AI/questions.
12. README: bảng thông tin giống hodi + các bước Stage 0 ở mục 2.
13. `AGENTS.md` + `CLAUDE.md` (`@AGENTS.md`): copy từ hodi, đổi tên, thêm dòng
    "Plan: PLAN-legi.md. Follow it phase by phase."

Checklist:
- [ ] Đăng nhập Google trên emulator được; email khác bị chặn ở client và ở rules.
- [ ] Đổi theme không nháy trắng khi tải lại trang.
- [ ] `npm run build` ra thư mục `out/`; mở bản build, tắt mạng, tải lại vẫn thấy trang.

---

### P1 - Ghi quote

Mục tiêu: tạo sách, chọn chương, gõ quote tiếng Việt thật nhanh, không bao giờ mất chữ.

**1. `LibraryContext` + `repo.ts`** đầy đủ như 5.1 và 5.2 (phần P1: book, quote, trash, restore, purge).

**2. `/shelf/` (bản list).** Danh sách sách chia 3 nhóm `reading · finished · later`, sắp xếp
theo `lastOpenedAt` giảm dần. Mỗi dòng: tên sách (sans 16px), tác giả + số quote (`faint`).
Cuối trang: `+ book` → ô nhập tên sách tại chỗ → Enter → `createBook` → mở `/book/?id=`
với ô nhập đã focus. Không bắt nhập tác giả.

**3. Header trang sách.** Tên sách, tác giả, dòng tiến độ `p. 142 / 320` (ẩn nếu chưa có trang nào,
hiện `p. 142` nếu chưa có totalPages). Chạm vào tên sách → form sửa tại chỗ: title, author,
total pages, format (`paper · pdf`), pdf link (chỉ hiện khi pdf), status (`reading · finished · later`),
`delete book`. Lưu khi rời ô (blur), không có nút save. Cập nhật `lastOpenedAt` và `legi.last` khi mở sách.

**4. Section tối thiểu.** Thanh soạn thảo có dòng ngữ cảnh: đường dẫn section đang chọn
(`Ch 3 › 3.2 Cue`) hoặc `no chapter`. Chạm vào → bottom sheet `SectionPicker`:
- Danh sách cây các section (thụt lề theo cấp), chạm để chọn.
- Ô `new section` ở cuối, kèm lựa chọn `top level · inside <current>`. Enter → `addSection` → chọn luôn.
- Section đang chọn lưu ở `legi.ctx.<bookId>`.
Trang sách hiển thị quote theo cây section (dùng `buildTree`). Section không có quote vẫn hiện heading.

**5. Thanh soạn thảo `Composer`** (cố định ở dưới, trên safe-area; desktop nằm cuối cột chữ, cũng cố định).
- `GrowText` cho chữ, tối đa cao 40% màn hình rồi cuộn bên trong.
- Ô `page`: `inputMode="numeric"`, rộng 4 chữ số. Giá trị mặc định = page của quote vừa lưu trong
  phiên này, nếu không có thì `book.currentPage`.
- Nút `quote | thought` (chọn kind, nhớ theo phiên).
- `+ note`: hiện ô note thứ hai (GrowText, sans, nhỏ hơn).
- `save`: chỉ sáng (`ink`) khi có chữ, còn lại `faint`.
- **Hành vi phím:**
  - `Enter`: xuống dòng bình thường.
  - `Enter` khi con trỏ ở cuối chữ **và** dòng hiện tại trống (tức chữ kết thúc bằng `\n`) → chốt quote.
  - `⌘Enter` / `Ctrl+Enter` → chốt quote ở bất kỳ đâu.
  - `Tab` trong ô chữ → nhảy sang ô page. `Shift+Tab` quay lại.
  - `Esc` → bỏ focus (nháp vẫn giữ).
  - `n` (khi không focus ô nào) → focus ô chữ.
  - Tất cả kiểm tra `isComposing` trước (mục 4.4).
- **Chốt quote** (`commit()`):
  1. `takePageToken` → nếu có số trang thì ghi đè ô page.
  2. `tidy(text)`, `tidy(note)`. Chữ rỗng thì không làm gì.
  3. `splitBlocks` bản P1: tách theo dòng trống (`/\n[ \t]*\n/`). Nếu > 1 khối → hiện ngay trên
     thanh soạn thảo: `Split into 3 quotes?` `split · keep as one`. Gõ tay thì gần như không xảy ra,
     chủ yếu khi dán.
  4. `createQuote` cho từng khối: cùng book, section, page, kind; `source` = `paste` nếu nội dung
     đến từ sự kiện paste, còn lại `typed`.
  5. Nếu `page > book.currentPage` → `updateBook({ currentPage: page })`.
  6. Xoá nháp, làm trống ô, **giữ focus**, giữ page và section. Cuộn để quote mới hiện ngay trên thanh soạn thảo.
- **Nháp:** mỗi phím gõ ghi `legi.draft.<uid>/<bookId>` (`writeDraft`, `{ text, note, page, kind, at }`).
  Mở lại sách thì nạp nháp. Rời tab (`useSaveOnLeave`) không tự lưu thành quote, chỉ giữ nháp.

**6. Sửa quote tại chỗ.** Chạm (mobile) hoặc click (desktop) vào quote → quote đó thành
`QuoteEditor`: GrowText cho text và note, ô page, `quote | thought`, `delete`, `done`.
- Auto-save: 1 giây sau phím cuối → `updateQuote` (chạy `tidy` khi bấm `done` hoặc rời quote, không chạy lúc gõ).
- Nếu snapshot từ máy khác đổi text của quote đang sửa: không ghi đè chữ đang gõ; khi lưu thì
  dùng `mergeTexts` copy từ `hodi/src/lib/page-data.ts`.
- Xoá hết chữ rồi `done` → coi như `delete`.
- `Esc` hoặc chạm ra ngoài → về chế độ đọc.

**7. Xoá mềm + Undo + Trash.**
- `delete` → `trashQuotes` → dòng `Deleted · undo` ở dưới màn hình 5 giây (`UndoBar`). `⌘Z`
  (khi không focus ô nhập) cũng undo.
- `delete book` (trong form sửa sách) → hỏi tại chỗ `Delete book and 24 quotes?` `delete · cancel`
  → `trashBook` → về `/shelf/` + UndoBar.
- `/trash/`: danh sách sách và quote đã xoá, mới nhất trước, mỗi dòng có `restore` và số ngày còn lại
  (`27 days`). Không có nút xoá hẳn.
- `purgeTrash` chạy khi mở app, tối đa 1 lần/ngày (`legi.purgedAt`).

**8. Mở đúng chỗ cũ.** Lưu vị trí cuộn `legi.scroll.<bookId>` (throttle 500ms). Mở sách thì cuộn
lại chỗ đó sau khi dữ liệu có; nếu mở bằng `?new=1` thì cuộn xuống cuối và focus ô nhập.

**9. `/`** P1: có `legi.last` và sách còn tồn tại → `router.replace('/book/?id=...')`
(giữ `&new=1` nếu có); không có → `/shelf/`.

**10. Hub.** Thêm một dòng `legi` vào `../hub/index.html` theo đúng mẫu dòng hodi
(`desc`: `Quotes from the books you read.`, `meta`: `legi.kyphan38.com`, icon SVG từ 6.5).
Cập nhật số app trong `<meta name="description">` của hub nếu có đếm. Commit trong repo hub riêng.

Test (`node:test`): `vi.test.ts`, `typo.test.ts`, `page-token.test.ts`, `paste.test.ts`
(tách dòng trống, giữ xuống dòng đơn), `order.test.ts`, `outline.test.ts` (`buildTree`, `pathOf`,
`addSection`), `trash.test.ts` (tính ngày còn lại, chọn đúng doc cần purge, restoreBook chỉ khôi phục
quote `trashedWithBook` cùng `deletedAt`).

Checklist:
- [ ] Gõ Telex trên Mac (bộ gõ macOS và một bộ gõ như EVKey/Unikey): `Enter` trên dòng trống không bao giờ cắt mất dấu của chữ cuối.
- [ ] Gõ trên iPhone bàn phím tiếng Việt: không zoom, không gạch đỏ, viết hoa đầu câu.
- [ ] Tắt mạng, gõ 5 quote, tải lại trang: cả 5 vẫn còn; bật mạng: StatusDot chuyển sang đặc.
- [ ] Đang gõ dở, tắt app, mở lại: nháp còn nguyên.
- [ ] Xoá → undo → quote trở lại đúng chỗ. Xoá sách → Trash có sách → restore → đủ quote.
- [ ] Câu mẫu "Người ở lại, nghĩ về những điều đã qua." hiện đủ dấu, không chạm dòng trên, ở cả 3 cỡ chữ và 2 theme.

---

### P2 - Cấu trúc và sắp xếp lại

Mục tiêu: sách dài vẫn biết mình đang ở đâu; quote sai chỗ thì sửa rất nhanh.

**1. Outline.**
- Desktop (≥ 1024px): cột trái cố định 14rem. Cây section, mỗi dòng có số quote (`faint`).
  Section đang xem đậm hơn (`ink`, `font-medium`), dùng `IntersectionObserver` trên các heading.
  Chạm → cuộn tới (smooth, trừ khi reduced-motion).
- Mobile/tablet: dòng mảnh cố định ngay dưới TopBar, hiện đường dẫn section đang xem
  (`Ch 3 › 3.2 Cue`), cắt bằng `…` nếu dài. Chạm → bottom sheet outline (cùng component với cột trái).
- **Minimap (mobile/tablet):** đường dọc 2px ở mép phải, cao bằng vùng nhìn thấy. Mỗi section cấp 1
  là một vạch ngang 6px tại vị trí tương ứng trong trang. Một đoạn đậm hơn thể hiện vùng đang xem.
  Chạm vào vạch → cuộn tới. Ẩn khi sách có < 3 section.

**2. Đóng/mở section.** Chạm vào heading → đóng/mở. Đang đóng thì hiện số quote bên phải heading.
Lưu ở `legi.fold.<bookId>`. Phím: `[` đóng hết, `]` mở hết. Trong outline sheet có `fold all · unfold all`.

**3. Sửa outline.** Trong outline có `edit` → chế độ sửa:
- Mỗi dòng là ô input đổi tên (lưu khi blur).
- Desktop: `Tab` = thụt vào (thành con của mục ngay trên), `Shift+Tab` = thụt ra, `⌥↑/⌥↓` = đổi chỗ.
- Mobile: chạm giữ một dòng → menu `indent · outdent · up · down · delete`.
- `delete` section: quote và section con chuyển lên mục cha. Hỏi tại chỗ nếu section có quote.
- `paste contents`: textarea để dán mục lục. `parseToc`: mỗi dòng một section; cấp = số tab hoặc
  số cụm 2 dấu cách ở đầu dòng, **hoặc** số đoạn trong đánh số đầu dòng (`3` = cấp 1, `3.2` = cấp 2,
  `3.2.1` = cấp 3). Giữ lại cả chữ đánh số trong title. Thêm vào cuối outline hiện có.

**4. Tiến độ.** Thanh mảnh 2px dưới dòng `p. 142 / 320` (track `--sunk`, phần đã đọc `--ink`).
Nút `stopped at` → ô số tại chỗ → Enter → `updateBook({ currentPage })`. Không tạo quote.

**5. Chọn nhiều.**
- Mobile: chạm giữ 450ms một quote → menu: `edit · favorite · move · select · delete`.
  `select` → vào chế độ chọn; chạm các quote khác để chọn thêm.
- Desktop: `x` chọn quote đang focus; `Shift+click` chọn nhiều.
- Thanh dưới cùng khi đang chọn: `3 selected` `move · merge · delete · cancel`.

**6. Move.** Bottom sheet: chọn sách (danh sách, `reading` lên đầu) → chọn section (cây) hoặc
`no chapter`. Chọn xong là chuyển ngay (`moveQuotes`) + UndoBar `Moved · undo`.
Có thêm mục `Inbox` (bookId null).

**7. Merge / Split.**
- `merge`: chỉ hiện khi các quote chọn cùng một sách. Sắp theo thứ tự hiển thị. Giữ id của quote đầu.
  `text` nối bằng một dấu cách; `note` nối bằng `\n\n` (bỏ note rỗng); `page` = nhỏ nhất;
  `favorite` = có ít nhất một cái là favorite. Các quote còn lại vào Trash. UndoBar `Merged · undo`.
- `split here`: nút trong `QuoteEditor`, tách tại vị trí con trỏ. Phần sau thành quote mới cùng
  book, section, page, kind; note ở lại quote đầu. UndoBar `Split · undo`.

**8. Inbox `/inbox/`.** Quote có `bookId == null`. Có Composer (không có dòng section, không có page
mặc định). Chọn nhiều → `move` như trên. Trên `/shelf/` hiện `Inbox 7` (chỉ khi > 0).

**9. Phím tắt desktop (trang sách).** `j/k` focus quote tiếp/trước (viền focus `faint`, cuộn vào giữa),
`e` hoặc `Enter` sửa, `x` chọn, `m` move, `Backspace` xoá (có undo), `Esc` thoát, `⌘Z` undo,
`?` mở danh sách phím tắt (copy kiểu `Shortcuts.tsx` của hodi).

Test: `outline.test.ts` thêm `indent/outdent/moveUp/moveDown/removeSection/parseToc`
(các trường hợp: tab, 2 dấu cách, `3.2.1`, dòng trống bị bỏ), `merge.test.ts`, `split.test.ts`,
`undo.test.ts` (undo của move trả về đúng book/section cũ).

Checklist:
- [ ] Sách có 3 cấp, 40 section: outline cột trái theo đúng chỗ đang cuộn.
- [ ] Dán mục lục 20 dòng có `1.`, `1.1`, `1.1.1` ra đúng cây.
- [ ] Chọn 5 quote trong Inbox → move vào sách → undo → về lại Inbox.
- [ ] Trên iPhone, chạm giữ không bật menu copy/select chữ của iOS (`-webkit-user-select: none` và `-webkit-touch-callout: none` trên vùng quote khi không sửa).

---

### P3 - Kệ sách, Daily, tìm kiếm, export

**1. Kệ sách `/shelf/`.** Nút `shelf · list` ở trên (nhớ trong `legi.shelfView`, mặc định `shelf`).
- Ba kệ: `reading`, `finished`, `later` (ẩn kệ rỗng). Tên kệ: sans 13px `faint`.
- Mỗi kệ: `flex-wrap`, `align-items: flex-end`, `gap: 4px`. Dưới mỗi hàng là một đường kẻ 1px `--line-strong` (mặt kệ).
- Gáy sách (`Spine`):
  - Rộng: `min(56, 14 + 6 * sqrt(quoteCount))` px.
  - Cao: `totalPages == null ? 160 : 140 + 60 * min(totalPages, 800) / 800` px.
  - Màu: `--spine-{1..4}` theo `hash(bookId) % 4`. Chữ: `ink` trên spine 1-2, `bg` trên spine 3-4.
    Kiểm tra độ tương phản ≥ 4.5:1 ở cả 2 theme.
  - Tên sách: `writing-mode: vertical-rl`, sans 12px, cắt bằng `…` theo chiều cao.
  - Hover/focus: `translateY(-4px)` 150ms. Chạm → mở sách.
  - `aria-label`: `"{title}, {n} quotes"`.
- `+ book` là một gáy rỗng viền nét đứt ở cuối kệ `reading`.

**2. Favorite.** Phím `f`, mục `favorite` trong menu chạm giữ, và nút sao trong `QuoteEditor`.

**3. Nhấn mạnh.** Bôi đen chữ trong ô nhập hoặc `QuoteEditor` → `⌘B`, hoặc nút `B` trên thanh
soạn thảo → `toggleEmph` bọc/bỏ `**`. Khi đọc, `parseEmph` render `<strong class="font-semibold">`.
`fold`, `dupKey`, export JSON bỏ hoặc giữ `**` đúng như mục 4.1; export Markdown giữ `**`.

**4. Daily quote.**
- `pickDaily(quotes, day, books)`: ứng viên = quote kind `quote`, chưa bị xoá, sách chưa bị xoá.
  Lấy nhóm có `shownCount` nhỏ nhất (không lặp lại cho tới khi xem hết). Trong nhóm, chọn ngẫu
  nhiên có trọng số bằng RNG có seed (`mulberry32(hash(day))`): favorite × 3, còn lại × 1
  (P5 nhân thêm `revisitBoost`). Cùng dữ liệu + cùng ngày → luôn ra cùng một quote.
- Khi mở `/` lần đầu trong ngày (`legi.dailySeen != dayOf(now)`):
  1. Đọc `daily/{day}`. Có rồi → dùng `quoteId` đó.
  2. Chưa có → `pickDaily` → `writeBatch`: tạo `daily/{day}` + quote `shownCount + 1`, `lastShownAt = now`.
     (Rules chỉ cho tạo 1 lần, nên máy thứ hai sẽ bị từ chối và đọc lại doc của máy đầu.)
  3. Hiện `DailyView`: quote ở giữa màn hình (serif, cỡ quote + 2px), typewriter (mục 5),
     dưới là `Book · Chapter › Section · p. 52` (sans 13px `faint`).
  4. Dưới cùng: `open in book` (mở sách, cuộn tới quote, nháy viền 1 lần) và `continue` (về sách gần nhất).
     Bấm bất kỳ phím chữ nào → `continue` và focus ô nhập.
     `another` (2026-10-17): hiện thêm 1 câu ngẫu nhiên (`pickAnother`, bỏ các câu đã hiện lần này,
     vẫn ưu tiên câu ít hiện nhất), cộng `shownCount`. Không đổi `daily/{day}`.
  6. Mở lại (2026-10-17): `daily` trên thanh trên và trong ⌘K → `/?daily=1` → luôn hiện lại
     đúng câu Daily của hôm nay (không chọn câu mới).
  5. Ghi `legi.dailySeen`.
- **On this day:** dưới Daily, nếu có quote tạo đúng ngày-tháng này ở năm trước thì hiện 1 dòng nhỏ:
  `2025 · Atomic Habits` + đoạn đầu của quote (cắt 80 ký tự). Chạm → mở quote đó. Không có thì không hiện gì.
- Chưa có quote nào → bỏ qua Daily, vào thẳng sách.

**5. Typewriter (`Typewriter.tsx`).** Chỉ dùng cho Daily (và Read slowly ở P4).
- Tách bằng `graphemes()`. Mỗi grapheme chờ `clamp(10, 2500 / n, 35)` ms (tổng tối đa ~2.5 giây).
- Chạm hoặc nhấn phím → hiện hết ngay.
- Phần chưa hiện vẫn giữ chỗ (render `visibility: hidden`) để chữ không làm nhảy layout.
- `aria-label` chứa toàn bộ chữ; phần animation `aria-hidden`.
- Reduced-motion hoặc `legi.typewriter = off` → hiện ngay.
- Không nháy con trỏ giả. Chỉ hiện chữ dần dần.

**6. Tìm kiếm.**
- `searchAll(query, books, quotes)`: `fold` query, tách theo khoảng trắng; một quote khớp khi
  **mọi** từ đều có trong `fold(text + ' ' + note)`. Cũng tìm tên sách, tác giả, tên section.
  Kết quả nhóm theo sách, sách nhiều kết quả lên trước, tối đa 50 quote.
  Phần khớp tô `font-semibold` (dùng `foldWithMap`).
- Desktop: `⌘K` hoặc `/` mở `CommandPalette` (lớp phủ ở giữa trên, rộng 36rem).
  Không gõ gì → hiện lệnh. Gõ → kết quả tìm + lệnh khớp tên.
  Lệnh: `new book`, `inbox`, `trash`, `settings`, `theme: system/light/dark`, `size: s/m/l`,
  `export markdown`, `export json`, `read slowly` (P4), tên từng sách (mở sách).
  `↑/↓` chọn, `Enter` chạy, `Esc` đóng.
- Mobile: link `search` ở TopBar → `/search/`: ô tìm ở trên, kết quả bên dưới, cùng logic.
- Chạm kết quả → mở sách, cuộn tới quote, nháy viền 1 lần.

**7. Export.** Settings → `Export` → `markdown · json`. Trong form sửa sách thêm `copy as markdown`.
- `toMarkdown`: mỗi sách (theo tên, `viCollator`):
  ```
  # Atomic Habits
  James Clear

  > What stays with you: ...   (nếu có takeaway)

  ## Chapter 3  The Habit Loop
  ### 3.2  Cue

  Thói quen là lời giải ... (p. 52)

  Note: ghi chú của bạn

  Thought: suy nghĩ ...
  ```
  Heading `#` thêm theo cấp section. Quote trong Inbox đặt cuối file dưới `# Inbox`.
- `toJson`: `{ app: 'legi', version: 1, exportedAt, books, quotes }` (bỏ những gì trong Trash).
- Tên file: `legi-YYYY-MM-DD.md` / `.json`. Có `navigator.canShare({ files })` → dùng Share sheet
  (iPhone PWA); không thì tải bằng `<a download>` với Blob.

**8. `/` hoàn chỉnh:** Daily (khi lần đầu trong ngày) → sách gần nhất → kệ sách.

Test: `daily.test.ts` (cùng seed cùng kết quả; nhóm `shownCount` nhỏ nhất; favorite được chọn nhiều
hơn trong 1000 ngày giả; onThisDay đúng ngày-tháng, bỏ năm hiện tại), `search.test.ts` (không dấu,
nhiều từ, `đ`), `emph.test.ts`, `export.test.ts` (snapshot một sách 2 cấp có note và thought),
`spine.test.ts` (rộng/cao trong giới hạn).

Checklist:
- [ ] Mac và iPhone cùng thấy một Daily quote trong ngày.
- [ ] Typewriter không tách rời dấu của "ệ", "ữ" (thử với chữ dán từ PDF dạng NFD).
- [ ] Tìm "thoi quen" ra "thói quen"; tìm "duong" ra "đường".
- [ ] Export markdown trên iPhone mở Share sheet, lưu vào Files được.

---

### P4 - Nhập nhanh và suy ngẫm

**1. Smart paste đầy đủ (`cleanPaste`).** Chạy trong sự kiện `paste` của Composer
(`e.preventDefault()`, chèn chữ đã làm sạch tại vị trí con trỏ):
1. NFC, `\r\n`→`\n`, bỏ `\u00AD`.
2. Nối chữ bị ngắt dòng: `(\p{L})-\n(\p{Ll})` → `$1$2`.
3. Bỏ dòng chỉ có số (số trang bị copy lẫn), hoặc dạng `- 52 -`.
4. Trong một đoạn (giữa 2 dòng trống): nối các dòng bằng một dấu cách, **trừ khi** dòng trước kết
   thúc bằng `. ! ? : … ” "` **và** dòng sau bắt đầu bằng chữ hoa, `-`, `•`, hoặc số + `.`.
5. Gộp nhiều dấu cách.
6. `looksBroken` → hiện dưới ô nhập: `Text looks broken. Try a photo.` (link sang capture ở P5,
   trước P5 thì chỉ là chữ).
Sau đó `commit()` dùng `splitBlocks` bản đầy đủ: dòng bắt đầu bằng `#`, `##`, `###` là heading →
tạo section (cấp theo số `#`, nằm dưới section đang chọn nếu có). Quote sau heading thuộc section đó.
Hỏi `Split into 6 quotes and 2 sections?` `split · keep as one`.

**2. ~~Nhập từ Google Play Books~~** - bỏ (chủ app quyết định ngày 2026-10-13). PDF thì copy rồi dán (smart paste).

**3. Chống trùng (`dup.ts`).**
- `trigrams(dupKey(s))`, `dice(a, b) = 2|A∩B| / (|A|+|B|)`.
- Trùng khi `dice ≥ 0.8`, **hoặc** một `dupKey` chứa trọn cái kia và cái ngắn hơn ≥ 20 ký tự.
- Composer: chạy sau 300ms ngừng gõ, khi chữ ≥ 20 ký tự. Tìm trong mọi quote chưa xoá (mọi sách).
  Hiện 1 dòng dưới ô nhập: `Similar in Atomic Habits, p. 52` `open · save anyway`.
  Không chặn: `⌘Enter` vẫn lưu được (coi như save anyway).
- `QuoteEditor`: cũng chạy, bỏ qua chính nó.
- Hiệu năng: cache trigram của mọi quote trong `LibraryContext` (tính lại khi text đổi).
  Lọc trước theo độ dài (`0.5 ≤ lenA/lenB ≤ 2` cho nhánh dice).

**4. Nghi thức đọc xong.** Khi status đổi sang `finished` (lần đầu, `takeaway == null`):
`finishedAt = now`; dưới header hiện `What stays with you?` + GrowText (serif) + `save · skip`.
Có takeaway thì hiện ngay dưới header sách (serif, `muted`) và ở đầu file export.
Chạm vào để sửa.

**5. Read slowly `/slow/?id=&from=`.** Lệnh trong menu sách và palette.
- Toàn màn hình, không TopBar. Một quote ở giữa (serif, cỡ quote + 3px, `max-width: 32rem`).
- Trên cùng `faint`: `Chapter › Section`. Dưới cùng `faint`: `p. 52` và `12 / 140`.
- `→`, `Space`, chạm nửa phải, vuốt trái → câu tiếp. `←`, chạm nửa trái, vuốt phải → câu trước. `Esc` → về sách, cuộn tới quote đang xem.
- Đổi câu: mờ ra 120ms, mờ vào 180ms. Typewriter nếu `legi.typewriter = on`.
- Nút nhỏ góc trên phải: `all · starred`.
- Chỉ kind `quote` và `thought`.

Test: `paste.test.ts` mở rộng (chữ PDF có ngắt dòng giữa câu, ngắt chữ có gạch nối, số trang lẫn,
heading `#`), `dup.test.ts` (giống 85%, khác dấu thì không trùng,
chứa trọn), `finish.test.ts` nếu có logic thuần.

Checklist:
- [ ] Copy 1 đoạn từ PDF tiếng Việt (Preview trên Mac) → dán → thành câu liền mạch, đúng dấu.
- [ ] Dán ghi chú cũ từ Apple Notes có `#` và `##` → ra đúng section và quote.
- [ ] Lưu lại 1 câu đã có (sửa 1-2 chữ) → hiện dòng `Similar in ...`.
- [ ] Read slowly chạy mượt bằng vuốt trên iPhone.

---

### P5 - AI chụp ảnh, Revisit, Questions

**1. Cloud Function `extractPage`** (`functions/src/index.ts`, `onCall`, `secrets: [GEMINI_API_KEY]`,
`timeoutSeconds: 120`, `memory: '512MiB'`). Copy `guard()`, `access.ts`, `gemini.ts` từ hodi.
- Input: `{ images: string[] /* base64 JPEG, tối đa 4 */, mode: 'marked' | 'all' }`.
  Từ chối nếu tổng > 8MB.
- Gọi Gemini với ảnh (inline data) + prompt (tiếng Anh) + JSON schema:
  ```json
  { "pages": [ { "page": 52, "runningHead": "The Habit Loop",
      "passages": [ { "text": "...", "marked": true } ] } ] }
  ```
- Prompt phải nói rõ:
  - Copy chữ **đúng nguyên văn**, giữ đủ dấu tiếng Việt, không sửa câu, không dịch, không tóm tắt.
  - Nối các dòng bị ngắt trong cùng một đoạn, nối chữ bị ngắt có gạch nối.
  - `marked = true` nếu đoạn đó được gạch chân, đóng ngoặc, khoanh, highlight hoặc đánh dấu bên lề bằng bút.
  - `mode = 'marked'`: chỉ trả các đoạn được đánh dấu, mỗi đoạn đánh dấu là một passage.
  - `page`: số trang in trên trang (null nếu không thấy). `runningHead`: dòng tên chương ở đầu/chân trang (null nếu không có).
  - Bỏ qua chữ viết tay bên lề (không đưa vào text).
- Không lưu ảnh, không ghi log nội dung. Chỉ trả JSON.
- `scripts/functions-env.mjs` và `fn:*` scripts copy từ hodi. README thêm bước
  `firebase functions:secrets:set GEMINI_API_KEY`.

**2. Chụp ảnh trong app.** Thanh soạn thảo có thêm nút icon máy ảnh (SVG một nét).
- `<input type="file" accept="image/*" capture="environment" multiple>`.
- Nén ở client: `createImageBitmap` → canvas, cạnh dài tối đa 1600px, JPEG 0.8.
- Có mạng → gọi `extractPage` (mode `marked`) → mở `/capture/?book=`.
- Không có mạng → lưu vào **snap queue** (mục 3).

**3. Snap for later (`src/lib/snaps.ts`).** IndexedDB thuần (không thư viện), database
`legi-snaps`, store `snaps`: `{ id, uid, bookId, sectionId, blob, createdAt }`.
**Ảnh chỉ nằm trên máy**, không lên Firebase Storage.
- Trên `/shelf/` và trong sách: `Snaps 3` (chỉ khi > 0) → `/capture/?snaps=1`.
- Xử lý xong (đã save hoặc bỏ) → xoá snap khỏi IndexedDB.
- Sign out → xoá database `legi-snaps`.

**4. `/capture/` (màn hình duyệt).**
- Mỗi trang ảnh: `p. 52` (sửa được), section đoán được, danh sách passage.
- Passage `marked` được tick sẵn; passage khác hiện mờ, chưa tick (chỉ khi mode `all`).
- Mỗi passage sửa được tại chỗ (GrowText, serif).
- Đoán section: so `fold(runningHead)` với `fold(section.title)` bằng `dice` trên trigram, ≥ 0.6
  thì chọn section đó; không thì dùng section đang chọn trong Composer. Chạm để đổi (SectionPicker).
- Chống trùng chạy cho từng passage; passage trùng hiện `already saved` và không tick sẵn.
- Dưới cùng: `save 5 quotes` → `createQuote` hàng loạt, `source = 'ocr'`, cập nhật `currentPage`.
- Lỗi AI → một dòng `Could not read this photo.` `retry · keep for later`.
- Nút `read whole page` → gọi lại với mode `all`.

**5. Revisit.** Thêm `revisitBoost(book, now)` vào `pickDaily`: nếu sách đã `finished` và số ngày từ
`finishedAt` nằm trong `[5..9]`, `[27..33]` hoặc `[85..95]` thì quote favorite của sách đó nhân
trọng số × 4. Không thêm màn hình, không thông báo.

**6. Questions.**
- Composer: `quote | thought | question`.
- Quote kind `question`: sans, chữ `ink`, có chữ nhỏ `question` màu `faint` trước số trang.
- `/questions/`: danh sách câu hỏi chưa trả lời (`answeredBy == null`), nhóm theo sách.
  Link `questions 4` trên `/shelf/` khi > 0.
- Trong `QuoteEditor` của một question: `answered by…` → chọn một quote (dùng ô tìm kiếm của mục P3.6,
  giới hạn trong sách hiện tại trước) → `answeredBy = quoteId`. Câu hỏi đã trả lời hiện quote trả lời
  ngay bên dưới (chữ nhỏ, `muted`), chạm để tới quote đó.
- Thêm `/questions/` vào `PAGES` của service worker.

Test: `daily.test.ts` thêm revisit, `capture.test.ts` (đoán section, chọn sẵn passage), test cho
phần kiểm tra input của function (tổng dung lượng, số ảnh), `snaps` không cần test Node (IndexedDB).

Checklist:
- [ ] Gạch bút chì 3 câu trên một trang sách tiếng Việt → chụp → đúng 3 passage, đủ dấu, đúng số trang.
- [ ] Tắt mạng → chụp 2 ảnh → `Snaps 2` → bật mạng → xử lý được.
- [ ] Email khác gọi `extractPage` bị `permission-denied`.

### P6 - Góp ý sau khi dùng thật (2026-10-15)

**1. Cắt ảnh ngay sau khi chụp.** Khả thi, không cần thư viện.
- Hiện tại: `CameraButton` → `shrinkImage` → `/capture/`, không có bước cắt. Camera iOS
  (`<input type="file">`) cũng không cho cắt.
- Cách làm: sau khi chọn ảnh, mở màn cắt toàn màn hình: ảnh + khung chữ nhật có 4 góc kéo được
  (pointer events tự viết, đúng luật "không thư viện kéo thả"). `use` / `skip`. Nhiều ảnh thì
  cắt lần lượt. Cắt bằng canvas (`drawImage` với vùng nguồn) **trước** `shrinkImage`, nên ảnh cắt
  vẫn nét.
- Lợi: AI chỉ đọc vùng cần, ít đọc nhầm trang bên cạnh, ảnh nhỏ hơn.
- Hàm thuần `cropRect(natural, box)` (tính vùng cắt theo toạ độ ảnh thật) có test.
- Snap offline: cắt trước khi lưu snap, không cắt lại sau.

**2. Không thêm được mục con dưới mục con trên điện thoại.** Không phải lỗi dữ liệu, mà là
cách dùng khó tìm ra (UX). Code đã hỗ trợ cây nhiều cấp.
- Cách thêm hiện tại: chạm tên chương trong ô nhập → sheet `Chapter`. Ô `new section` có
  `same level · inside <mục đang chọn> · top level`. `inside` luôn là **mục đang chọn**, không
  phải mục mình muốn. Muốn thêm `edf` dưới `abc` phải: chọn `abc` (sheet đóng lại) → mở lại sheet
  → gõ `edf` → chạm `inside abc`. Nếu đang chọn `Chương 1` thì `inside` chỉ tạo mục ngang hàng `abc`.
- `contents` → `edit` không có nút thêm mục; chỉ có `paste contents`. `indent` cần có mục ngang
  hàng ở trên, nên phải tạo mục trước rồi mới thụt vào được.
- Nghi lỗi thật (cần thử trên iPhone): chạm giữ trong `edit` dễ bị huỷ vì ngón tay rung tạo
  `pointermove`; iOS còn hiện kính lúp khi chạm giữ vào ô nhập. Nút `···` vẫn dùng được.
- Sửa:
  - Trong `edit`, menu `···` của mỗi mục thêm `add inside` và `add below`: tạo mục rỗng đúng chỗ
    và focus vào ô đó để gõ tên luôn.
  - Trong sheet `Chapter`: chạm giữ (hoặc nút `+` nhỏ cạnh mỗi mục) để thêm mục con dưới mục đó
    mà không cần chọn trước.
  - Chạm giữ chỉ huỷ khi ngón tay đi xa hơn ~10px, không huỷ ở mọi `pointermove`.

**3. Trang bắt đầu cho mỗi mục, quote tự vào đúng mục theo số trang.** Khả thi.
- Dữ liệu: `Section.startPage: number | null`. Rules chỉ kiểm `sections` là list ≤ 500, nên
  **không cần sửa rules**; sửa `types/legi.ts` và đọc dữ liệu cũ thiếu trường thì coi là `null`.
- Nhập: trong `edit`, mỗi mục có ô số nhỏ `p.` bên phải. `paste contents` đọc số trang ở cuối
  dòng (`1.1 Thói quen ...... 23` → title `1.1 Thói quen`, `startPage 23`).
- Hàm thuần `sectionForPage(sections, page)`: lấy mục có `startPage` lớn nhất mà ≤ `page`;
  bằng nhau thì lấy mục sâu hơn (mục con thắng chương). Không mục nào có `startPage` → `null`
  (giữ ngữ cảnh dính như cũ). Có test.
- Dùng ở: Composer, số trang trong ô `p.` luôn quyết định mục (cả số đã có sẵn từ trước, tính lại
  lúc lưu); chọn mục bằng tay thì thắng cho tới khi đổi số trang; `/capture/` khi AI đọc
  được số trang (ưu tiên hơn đoán theo `runningHead`).
- Không tự chuyển quote cũ. Trong `edit` có nút `place N quotes by page` (chỉ hiện khi N > 0,
  undo được) để chuyển quote cũ có số trang vào đúng mục.

**4. Ghi câu hay ngoài sách (YouTube, web, bạn bè, ...).** Chủ app chọn **A** (2026-10-15).
- Đã làm: `format` thêm `video | web | person` (rules + `types`), `src/lib/source.ts`
  (`isSource`). Kệ sách bỏ qua nguồn; dưới kệ có nhóm `elsewhere` (danh sách + `+ source`, chọn
  `video · web · person`). Trang nguồn: không có số trang, trạng thái đọc, ô `p.`; có `by`,
  `kind`, `link` (dùng lại `pdfUrl`).
- **Phải deploy rules mới** (`npm run rules && firebase deploy --only firestore:rules`) trước khi
  thêm nguồn trên bản thật, nếu không lệnh ghi bị từ chối.
- Hiện có: Inbox (`bookId = null`) nhận được câu bất kỳ, nhưng không ghi được nguồn và lẫn với
  câu chưa phân loại.
- Phương án A (đề xuất): dùng lại `Book` làm "nguồn". Thêm `format` mới `'video' | 'web' |
  'person'` (sửa rules `format in [...]`), `author` = kênh / trang / người, thêm `url` (dùng lại
  `pdfUrl` hoặc trường mới). Mọi thứ đã có (quote, thought, Daily, tìm kiếm, export, mục con)
  chạy luôn. Kệ sách chỉ hiện `paper`/`pdf`; nguồn khác vào một trang `/sources/` (danh sách
  đơn giản), hoặc một nhóm `elsewhere` dưới kệ.
- Phương án B: một nguồn chung `Elsewhere`, mỗi quote ghi thêm `from` (chữ tự do, ví dụ
  `Ali Abdaal`, `anh Tuấn`). Ít màn hình hơn, nhưng phải sửa rules của quote và khó xem theo nguồn.

Checklist P6:
- [ ] iPhone: chụp 1 trang → kéo 4 góc → `use` → AI chỉ đọc phần đã cắt.
- [ ] iPhone: `contents` → `edit` → `···` → `add inside` dưới một mục con, gõ tên tiếng Việt.
- [ ] iPhone: chạm giữ một mục trong `edit` mở menu, không bị huỷ vì ngón tay rung.
- [ ] Đặt `p.` cho vài mục → gõ số trang ở ô nhập → chip chương đổi đúng.
- [ ] `paste contents` với mục lục có số trang ở cuối dòng.
- [ ] Thêm một nguồn `person` → ghi 1 câu → câu đó có trong tìm kiếm, Daily, export.

---

## 8. Những gì KHÔNG làm

- Backup tự động lên Google Drive (chủ app bỏ ngày 2026-10-13).
- Streak, huy hiệu, mục tiêu số sách, thông báo đẩy, nhắc đọc.
- AI viết thought, tóm tắt sách, gợi ý suy nghĩ.
- Ảnh bìa sách, tự tìm thông tin sách (Google Books / Open Library).
- Tag.
- Lưu file PDF trong app.
- Hiệu ứng lật trang giả.
- Kéo thả bằng thư viện; vuốt để xoá.
- Markdown render (ngoài `**nhấn mạnh**`), bullet tự động.
- Chia sẻ công khai, nhiều người dùng.

## 9. Để sau

- Quote card: xuất 1 quote thành ảnh xám để chia sẻ.
- Kết nối hodi: Daily quote hiện thành câu hỏi mờ trên Today của hodi.
- Kết nối cogi: `think about this` gửi quote sang cogi.
- Liên kết quote với nhau (`related`).
- Trang `Year` (số sách đọc xong, số quote).

## 10. Nhật ký quyết định

| Ngày | Quyết định | Lý do |
|---|---|---|
| 2026-10-13 | Tên `legi` | `logi` đã là app ghi thời gian |
| 2026-10-13 | Khung copy từ hodi (static export, auth client, rules kiểm email) | Giống nhu cầu: chữ là chính, offline tốt, ít secret |
| 2026-10-13 | Plain text theo khối, tách bằng dòng trống, không bullet | Chủ app quen cách mỗi câu cách 1 dòng trống; ký hiệu khó gõ trên điện thoại |
| 2026-10-13 | Quote trước, metadata sau, có "ngữ cảnh dính" | Không bắt đi 3 bước khi đang đọc |
| 2026-10-13 | `sections` lưu trong doc sách, cây linh hoạt | Đổi cấu trúc là 1 lần ghi; sách có số cấp khác nhau |
| 2026-10-13 | `quotes` ở cấp trên, đọc hết vào bộ nhớ | Tìm kiếm, chống trùng, Daily chạy offline và đơn giản |
| 2026-10-13 | ~~Font serif hệ thống cho quote~~ (bỏ cùng ngày, xem dưới) | Cảm giác trang sách mà không cần màu kem |
| 2026-10-13 | Typewriter chỉ cho Daily và Read slowly | Mở sách mà gõ từng chữ thì chậm và phiền |
| 2026-10-13 | Không dùng roadmap; outline cột trái (desktop), breadcrumb + sheet + minimap (mobile) | Roadmap tốn chỗ, không giúp tìm nhanh |
| 2026-10-13 | `kind` có từ P1 (quote, thought); question ở P5 cùng trang Open questions | Thêm trường sớm thì rẻ; question chỉ có ích khi có trang riêng |
| 2026-10-13 | Xoá mềm, Trash 30 ngày, purge từ client theo rules | Không mất dữ liệu vì bấm nhầm |
| 2026-10-13 | Ảnh snap chỉ lưu trên máy (IndexedDB) | Riêng tư, không cần Storage rules; ảnh bị xoá sau khi xử lý |
| 2026-10-13 | Không backup Drive | Chủ app không cần; export là đủ |
| 2026-10-13 | Bỏ font serif, quote dùng font hệ thống (sans) 16/18/20px | Chủ app thấy serif khó đọc, nhìn như chữ nghiêng |
| 2026-10-13 | Giảm lặp: header chỉ còn tên sách, tác giả, thanh tiến độ (khi có tổng số trang); `stopped at` và số quote vào form sửa sách; số trang cạnh quote chỉ hiện khi rê chuột; cột mục lục không có số đếm, nút chỉ hiện khi rê chuột | Màn hình sách bị rối: tên chương, số trang, số quote mỗi thứ hiện 3 lần |
| 2026-10-13 | Bỏ minimap bên phải | Nhìn như rác; `contents` và dòng tên chương khi cuộn là đủ |
| 2026-10-13 | Kệ sách: chồng sách nằm ngang (gáy quay ra, tên đọc ngang; dày = số quote, dài = số trang, hơi lệch cho giống chồng thật) | Chữ dọc 90 độ trên gáy khó đọc; chủ app chọn xếp chồng thay vì bìa quay ra |
| 2026-10-13 | `Snaps N` chỉ hiện trên kệ sách, không trên trang sách | Header trang sách giữ tối giản |
| 2026-10-13 | Mục mới mặc định cùng cấp, ngay sau mục đang chọn (`same level · inside … · top level`) | Đọc theo thứ tự: 3.1 → 3.2 → 3.3 không cần bấm gì; trước đây mặc định `top level` làm lệch mục lục |
| 2026-10-13 | Nói thay vì gõ: nút micro, chạm để bắt đầu / chạm lại để dừng (tối đa 2 phút), ghi âm → function `transcribe` (Gemini) → chữ vào ô nhập; nói "xuống dòng", "đoạn mới" | Giống logi (đã chạy ổn trên iPhone PWA), nhưng không giữ-để-nói vì tay còn cầm sách |
| 2026-10-13 | Đếm ký tự khi gõ (theo chữ nhìn thấy) | Chủ app muốn biết mình đã gõ bao nhiêu |
| 2026-10-13 | `->` `<-` `<->` `=>` thành → ← ↔ ⇒ khi lưu và khi hiển thị | Nhìn đẹp hơn; quote cũ cũng hiện mũi tên |
| 2026-10-13 | quote = mọi thứ từ sách (nguyên văn hoặc tóm ý), thought = ý của mình, question; sao = câu đáng học. Daily lấy cả quote và thought | Không thêm loại mới để khỏi phải nghĩ mỗi lần ghi |
| 2026-10-13 | Nút `···` khi rê chuột vào quote (Mac); `move` mở thẳng các mục của cuốn đang đọc, `other book` để sang cuốn khác | Chuột phải / chạm giữ khó tìm ra |
| 2026-10-13 | Bỏ nhập từ Google Play Books | Chủ app không cần; PDF thì copy rồi dán |
| 2026-10-13 | Ô nhập còn 1 hàng điều khiển: chương · loại (bấm để đổi) · + note · p. · save; `B` chỉ hiện khi bôi đen; chưa chọn chương thì mặc định chương cuối của sách | Bớt nút; không còn `no chapter` khi sách đã có chương |
| 2026-10-15 | P6: cắt ảnh sau khi chụp; `add inside` / `add below` trong `edit`; chạm mục khi đang gõ tên mới để chọn chỗ đặt; `startPage` cho mục, quote tự vào mục theo số trang | Góp ý sau khi dùng thật trên điện thoại |
| 2026-10-15 | Câu hay ngoài sách: phương án A, mỗi nguồn (video, web, người) là một `Book` với `format` mới, không lên kệ sách | Chủ app muốn xem lại theo từng nguồn như một cuốn sách |
