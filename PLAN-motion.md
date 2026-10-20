# PLAN-motion - legi: chuyển động (ít)

Viết ngày 2026-10-21 để giao cho một AI khác làm (hoặc làm trong phiên
này). Owner chưa duyệt: hỏi owner trước khi bắt đầu P1.

**legi đã có nền chuyển động riêng** (`rise`, `fade-in`, `sheet-up`, `flash`,
`settle`, `--ease-soft`) và là app "tờ giấy" yên lặng như hodi. DESIGN.md xếp
legi vào nhóm "minimal". Plan này chỉ vá những chỗ thiếu (sheet đóng, dòng bị
xoá, vòng chờ) và gom về cùng một hệ với mora, logi, noda, fina.
Không thêm tính năng, không đổi bố cục.

## Prompt để dán cho AI làm

```
Work in /Users/kyphan/ws/app/legi. Read ws/app/AGENTS.md, legi/AGENTS.md,
legi/PLAN-legi.md (the invariants in section 1), ws/app/DESIGN.md (sections
"Motion" and "Layout") and legi/PLAN-motion.md first. Implement only phase
<P1> from PLAN-motion.md, exactly as written. Follow "Quy tắc cho mọi
phase", "CSS dùng chung" and "Lỗi hay gặp". Run every command in "Kiểm tra
mỗi phase" and fix all failures you caused. Then update README.md (Motion
section) and the "Tiến độ" list, commit only the files you changed on main
(no Co-Authored-By) and stop. Do not push unless I ask. Tell me in
Vietnamese, in short simple sentences, what changed and how to try it. Do
not start the next phase.
```

Đổi `<P1>` thành phase muốn làm. Mỗi lần chỉ một phase.

## Đọc trước khi làm

1. `ws/app/AGENTS.md` và `legi/AGENTS.md`: không em dash (U+2014), code và
   comment bằng tiếng Anh, chữ trên UI càng ít càng tốt, không ghi
   `Co-Authored-By`. **legi: chỉ commit, không push** nếu owner không bảo.
   Next.js ở đây là bản 16: đọc docs trong `node_modules/next/dist/docs/`
   nếu đụng tới API của Next.
2. `legi/PLAN-legi.md`, mục 1 (bất biến). Liên quan tới chuyển động:
   - **#3** Không bao giờ `await` một lệnh ghi Firestore trong luồng UI.
     Hiệu ứng không được chờ ghi xong.
   - **#5** Chỉ xám. **#6** Yên lặng: không toast, không popup. Ngoại lệ duy
     nhất là dòng `Deleted · undo` (`UndoBar`) trong 5 giây.
   - **#10** UI copy tối thiểu: không đổi chữ.
   - Reduced motion phải tắt animation **và typewriter** (xem
     `Typewriter.tsx`, đã làm).
3. `ws/app/DESIGN.md`, phần **Motion**.
4. Code đã làm cùng hệ thống này (copy ý, không import chéo repo):
   `logi/src/lib/motion.ts`, `logi/src/hooks/usePresence.ts`,
   `logi/src/hooks/useFlip.ts`, `logi/src/components/SheetShell.tsx`,
   `fina/src/hooks/useRowMotion.ts`. `logi/PLAN-motion.md` ghi các bẫy của
   React Compiler lint.

## Hiện trạng (2026-10-21)

- `src/app/globals.css` đã có token `--ease-soft` (dòng ~90) và các class
  `settle`, `rise` (220ms), `fade-in`, `sheet-up`, `flash`. Khối
  `prefers-reduced-motion` đặt `0.01ms`. Chưa có `fade-out`, `sheet-down`,
  `row-out`, `breathe`.
- `rise` đã dùng khi mở một cuốn sách: 12 trích đầu tiên hiện lần lượt trễ
  25ms (`QuoteItem.tsx`, `BookView.tsx`). Đây là hành vi đã có, **giữ nguyên**.
- Mọi sheet đi qua **một** component `src/components/Sheet.tsx`
  (`open`, `onClose`, `label`): `QuoteMenu`, `MoveSheet`, `AnswerPicker`,
  `SectionPicker`, `Outline` (panel), bảng phím tắt (`Shortcuts.tsx`). Nó
  chỉ có hiệu ứng vào (`sheet-up`, nền `fade-in`), không có hiệu ứng ra, không
  vuốt xuống. `Esc` và bấm nền đã đóng được.
- `CommandPalette.tsx` (chỉ màn rộng) và `CropView.tsx` (toàn màn hình) cũng
  chỉ có hiệu ứng vào.
- `UndoBar.tsx`: `fade-in` khi hiện, mất ngay khi hết 5 giây hoặc sau khi bấm
  `undo`.
- `VoiceButton.tsx` (dòng ~89) dùng `animate-pulse` cho chấm đang ghi âm.
- Xoá, chuyển, gộp một trích: dòng mất ngay (có `UndoBar`).
- Test: `node --test` trên hàm thuần (`test/*.test.ts`), không có test
  component. Có emulator (README: `npm run emu` cần Java 21, rồi
  `npm run dev:emu`, cổng 3070) với đăng nhập emulator tự động; dữ liệu mẫu
  `node scripts/seed-emu.mjs <uid>` (uid lấy từ `localStorage['legi.uid']`).
  Chức năng AI (OCR) cần Cloud Function và khoá Gemini nên không thử được
  trong emulator.

## Quy tắc cho mọi phase

- Theo phần **Motion** của DESIGN.md: chỉ `opacity` và `transform`, reduced
  motion phải chạy, không vòng lặp gây chú ý, không thư viện.
- Mỗi cử chỉ phải có cách thay thế (nút, phím, chữ có sẵn).
- Hiệu ứng không được làm chậm hay chờ việc ghi dữ liệu (bất biến #3).
- Không đổi chữ trên UI. Không đổi logic dữ liệu (`src/lib/*`, repo, undo).
  Hàm thuần mới phải có test.
- Giữ nguyên những gì đã có: `rise` khi mở sách, `flash`, `settle`,
  typewriter.
- Mỗi phase xong: thêm mục ngắn **Motion** vào `README.md`, ghi một dòng vào
  "Tiến độ" cuối file này, rồi **hỏi owner trước khi làm phase tiếp theo**.

## Kiểm tra mỗi phase

```bash
cd ws/app/legi
npx tsc --noEmit
npm run lint
npm test
npm run build
```

- `npm test` đã đặt `TZ=Asia/Ho_Chi_Minh`. Lưu output ra file rồi so số test
  passed với tổng.
- Thử trên app thật bằng emulator: `PATH=/opt/homebrew/opt/openjdk@21/bin:$PATH
  npm run emu` (cổng 8080), `npm run dev:emu` (cổng 3070 theo `legi-dev` trong
  `ws/app/.claude/launch.json`), rồi seed dữ liệu mẫu. Nếu không bật được
  emulator, dùng **trang tạm** `src/app/zz-*/page.tsx` (ngoài `(main)`), xoá
  sau cùng với `.next/dev/types`.
- Service worker của legi có thể giữ JS/CSS cũ trong trình duyệt: huỷ đăng ký
  và xoá cache trước khi kết luận về CSS.
- Pane trình duyệt của app có thể không vẽ hình (`visibilityState` là
  `hidden`, `requestAnimationFrame` không chạy). Nếu vậy ghi rõ "chưa thấy
  tốc độ".
- Thử màn 375px và màn rộng, light và dark, và một lần với reduced motion bật.
- Commit: chỉ add đúng đường dẫn đã sửa (`git add <file> ...`, không
  `git add -A`). Kiểm tra `git branch --show-current` là `main`. Message dạng
  `feat(motion): ...`. Không co-author. **Không push** nếu owner không bảo.

## Chỗ sửa chính (vị trí ngày 2026-10-21, có thể lệch vài dòng)

| Chỗ | File | Phase |
|---|---|---|
| Token, khối chuyển động, reduced motion | `src/app/globals.css:207-280` | P1 |
| Chấm ghi âm | `src/components/VoiceButton.tsx:~89` | P1 |
| Dòng Deleted · undo | `src/components/UndoBar.tsx` | P1 |
| Sheet | `src/components/Sheet.tsx` | P2 |
| Bảng lệnh, màn crop | `CommandPalette.tsx`, `CropView.tsx` | P2 |
| Dòng trích vào/ra | `src/hooks/useQuoteBoard.tsx`, `src/components/QuoteItem.tsx`, `BookView.tsx` | P3 |

## CSS dùng chung (sửa `globals.css`)

`--ease-soft` đã có (đang là `cubic-bezier(0.2, 0.8, 0.2, 1)`): **giữ giá trị
của legi**, không đổi. Thêm sau khối `sheet-up` (trước `flash`), đặt tên giống
mora, logi, noda, fina:

```css
@keyframes fade-out {
  to { opacity: 0; }
}
.fade-out {
  animation: fade-out 200ms ease-in both;
}

@keyframes sheet-down {
  to { transform: translateY(16px); opacity: 0; }
}
.sheet-down {
  animation: sheet-down 200ms ease-in both;
}

@keyframes row-out {
  to { opacity: 0; transform: translateX(8px); }
}
.row-out {
  animation: row-out 180ms ease-in both;
  pointer-events: none;
}

/* A slow fade in and out for "recording" or "waiting"; never blinks. */
@keyframes breathe {
  0%, 100% { opacity: 0.35; }
  50% { opacity: 1; }
}
.breathe {
  animation: breathe 3.2s ease-in-out infinite;
}
```

`rise` (220ms), `fade-in`, `sheet-up` giữ nguyên.

Thay khối reduced motion bằng khối chung (giữ dòng `scroll-behavior`):

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 1ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 1ms !important;
    scroll-behavior: auto !important;
  }
}
```

## Lỗi hay gặp (đọc kỹ)

1. **Không có test component.** Đừng cài jsdom. Logic thành hàm thuần trong
   `src/lib/motion.ts`, test trong `test/motion.test.ts`.
2. **legi đã đọc `prefers-reduced-motion` ở ba chỗ** (`Typewriter.tsx`,
   `BookView.tsx`, `useQuoteBoard.tsx`) bằng `matchMedia` trực tiếp. Code mới
   dùng `reducedMotion()` từ `src/lib/motion.ts`. **Không sửa** ba chỗ cũ.
3. **React Compiler lint (Next 16).** Cấm `setState` trong `useEffect`; tính
   state lúc render (mẫu `prev`/`setPrev` trong `logi/src/components/Toasts.tsx`).
   `setState` trong callback của `setTimeout` thì được.
4. **Hydration.** Trang render trên server (static export). Đừng đọc
   `matchMedia` lúc render đầu rồi đổi class theo nó.
5. **Sheet dùng portal.** `Sheet` render qua `createPortal` vào `document.body`
   (vì cha có `backdrop-filter` sẽ nhốt phần tử `fixed`). Giữ nguyên portal.
   Khóa cuộn `document.body.style.overflow` phải được trả lại **sau** khi hiệu
   ứng ra xong, không phải lúc bấm đóng.
6. **`Esc` đã được `Sheet` bắt ở pha capture** và chặn lan truyền. Giữ hành vi
   đó. Trong lúc sheet đang ra, `Esc` lần hai và bấm nền không làm gì thêm.
7. **Nút trong sheet đóng ngay, không chờ hiệu ứng.** `onClose` của các nút
   (move, answer, chọn mục) gọi thẳng như cũ. Chỉ bấm nền, vuốt xuống và `Esc`
   mới chạy hiệu ứng ra.
8. **Hàng trích tự bắt nhấn giữ bằng pointer events** (`QuoteItem.tsx`, ngưỡng
   `LONG_PRESS_MS`, huỷ khi di chuyển quá 8px). Đừng thêm cử chỉ vuốt lên hàng
   (đụng với cuộn và nhấn giữ).
9. **Không em dash.** Kiểm tra trước khi commit (zsh):
   `grep -rn $'\xe2\x80\x94' src test PLAN-motion.md README.md` phải rỗng.

---

## P1 - Nền móng: hàm, chấm ghi âm, dòng undo

### P1.1 CSS và hàm

File: `src/app/globals.css`, mới `src/lib/motion.ts`, `test/motion.test.ts`.

- Thêm các class và khối reduced motion như "CSS dùng chung".
- `src/lib/motion.ts`: `reducedMotion()` và `leavingItems()` (copy từ
  `logi/src/lib/motion.ts`). Test: `reducedMotion()` là `true` trong Node;
  `leavingItems` giống bài của logi.

### P1.2 Chấm ghi âm thở chậm

File: `src/components/VoiceButton.tsx`.

- Đổi `animate-pulse` thành `breathe` ở chấm đang ghi âm / đang xử lý. Không
  đổi gì khác.

### P1.3 Dòng Deleted · undo có hiệu ứng ra

File: `src/components/UndoBar.tsx`; mới `src/hooks/usePresence.ts` (copy từ
`logi/src/hooks/usePresence.ts`, import `reducedMotion` từ `@/lib/motion`).

- Khi hết 5 giây, hoặc sau khi bấm `undo`: dòng ở lại thêm 200ms với `fade-out`
  và `pointer-events-none`, rồi gỡ (`usePresence(visible, 200)`; giữ `entry`
  cuối trong state tính lúc render để chữ không đổi trong lúc mờ).
- Có thao tác mới (entry mới) trong lúc dòng cũ đang mờ: dòng mới hiện ngay.
- Logic `undo()`, `SHOW_MS`, `lastUndoStore` giữ nguyên. Bấm `undo` vẫn gọi
  `undo()` ngay lập tức (không chờ hiệu ứng).

Xong khi: xoá một trích thì dòng `Deleted · undo` hiện, sau 5 giây mờ đi; bấm
`undo` thì việc hoàn tác chạy ngay và dòng mờ đi; chấm ghi âm thở chậm thay vì
nhấp nháy; reduced motion thì mọi thứ hiện và mất ngay.

---

## P2 - Sheet, bảng lệnh, màn crop: đóng có hiệu ứng, vuốt xuống

### P2.1 `Sheet` có hiệu ứng ra

File: `src/components/Sheet.tsx`; dùng `usePresence` (từ P1).

- `Sheet` nhận `open`. Hiện nó `return null` khi `!open`. Dùng
  `usePresence(open, 200)`: khi `open` thành sai, giữ mounted 200ms với nền
  `fade-out` và panel `sheet-down`, rồi gỡ. Trong lúc ra: `pointer-events-none`
  trên cả sheet và `inert` trên panel (để phím không vào ô nhập bên trong).
- Khóa cuộn `document.body.style.overflow` và listener `Esc` chạy theo `open`
  hiện tại như cũ, nhưng trả lại `overflow` khi sheet thật sự gỡ (hết hiệu
  ứng), không phải lúc `open` thành sai (lỗi hay gặp số 5).
- Reduced motion: gỡ ngay như cũ.
- API (`open`, `onClose`, `label`, `children`) giữ nguyên: các chỗ dùng không
  đổi.

### P2.2 Vuốt xuống để đóng (điện thoại)

File: `src/components/Sheet.tsx`; hàm thuần `sheetShouldClose`, `dragOffset`
vào `src/lib/motion.ts` (copy từ `logi/src/lib/motion.ts`, kèm test).

- Chỉ màn hẹp (dưới `md`, đọc `matchMedia` lúc `pointerdown`, không lúc render).
  Một thanh nắm 40x4 `bg-line` ở đầu panel, chỉ hiện màn hẹp (`md:hidden`).
  Vùng kéo chỉ là thanh nắm cộng một dải cao khoảng 24px quanh nó (panel
  cuộn được, nên không đặt `touch-action: none` lên cả panel).
- Khi kéo: panel theo ngón tay qua `ref.style.transform`, không `setState`;
  kéo lên thì cản (`dragOffset`). Nền mờ dần theo `1 - dy / height`.
- Thả: đóng nếu `sheetShouldClose(dy, height, velocity)` đúng (copy cách làm
  của `logi/SheetShell.tsx`: trượt tiếp từ chỗ đang đứng rồi gọi `onClose`),
  nếu không thì bật về trong 200ms.
- Không bắt đầu kéo khi chạm vào `button`, `input`, `textarea`, `select`.
- Test: `sheetShouldClose(120, 400, 0)` là `true`; `(40, 400, 0.1)` là
  `false`; `(40, 400, 0.8)` là `true`; `dragOffset(-50)` là `-10`;
  `dragOffset(30)` là `30`.

### P2.3 Bảng lệnh và màn crop

File: `CommandPalette.tsx`, `CropView.tsx`.

- `CommandPalette` (chỉ màn rộng): ra bằng `fade-out` cho nền và `sheet-down`
  cho panel (200ms) khi đóng bằng `Esc` hoặc bấm nền. Chạy một lệnh (`run`)
  thì đóng ngay như cũ (gọi `onClose()` rồi `it.run()`).
- `CropView` (toàn màn hình, nền đen): ra bằng `fade-out` 200ms khi bấm huỷ.
  Bấm xong (đã cắt) thì đóng ngay như cũ.
- Cả hai dùng `usePresence` ở chỗ gọi chúng nếu chúng đang được render có
  điều kiện (`{open && <X/>}`), hoặc ở trong chính component nếu có `open`.

Xong khi: mọi sheet (menu của trích, chuyển, chọn mục, outline, phím tắt)
trượt xuống khi đóng bằng nền hoặc `Esc`; trên điện thoại vuốt xuống từ thanh
nắm thì đóng, vuốt ngắn thì bật lại; nút bên trong đóng ngay; gõ trong sheet
vẫn bình thường; reduced motion thì mọi thứ đóng ngay.

---

## P3 - Dòng trích vào và ra

File: `src/hooks/useQuoteBoard.tsx`, `src/components/QuoteItem.tsx`,
`BookView.tsx`; hook mới `src/hooks/useRowMotion.ts` (copy ý từ
`fina/src/hooks/useRowMotion.ts`), hàm `rowChanges` vào `src/lib/motion.ts`
(copy từ fina, kèm test); `src/hooks/useFlip.ts` (copy từ logi).

- Một trích **mới** xuất hiện lúc đang xem (lưu từ Composer, hoặc hoàn tác
  một lần xoá) vào bằng `rise` (không trễ). Một trích **bị xoá, chuyển hoặc
  gộp ra khỏi danh sách đang xem** ở lại 180ms với `row-out`, rồi gỡ; các dòng
  dưới trượt lên bằng `useFlip`.
- Mở một cuốn sách, đổi sách, đổi bộ lọc, hoặc tải lần đầu: **không chạy gì
  thêm** (ngoài `rise` 12 dòng đầu đã có). Hơn 3 dòng đổi cùng lúc là "thay danh
  sách" (nhập nhiều, đổi sách), không chạy (như fina).
- Dòng đang rời đi: `pointer-events: none`, không `onClick`, `aria-hidden`.
  Không giữ trích đang rời đi trong tập chọn (`selected`).
- Dòng đang **sửa** (`editingId`) không bao giờ có hiệu ứng ra.
- Không đổi `UndoBar`, `undo`, và thứ tự lưu. Hiệu ứng không chờ ghi Firestore
  (bất biến #3): dòng rời đi vì dữ liệu cục bộ đã đổi.
- `flash` (viền mờ khi mở một trích từ tìm kiếm hoặc Daily) giữ nguyên.

Xong khi: xoá một trích thì dòng trượt ra và dòng dưới nhích lên; bấm `undo`
thì dòng vào lại bằng `rise`; mở sách, đổi sách, đổi bộ lọc thì không có gì
thêm chạy; chọn nhiều rồi chuyển sang sách khác thì cả nhóm mất ngay (hơn 3
dòng).

---

## Không làm (ghi lại để AI sau khỏi đề xuất lại)

- **Toast hay popup** cho bất kỳ việc gì ngoài `UndoBar` (bất biến #6).
- **Đổi hiệu ứng mở sách** (`rise` 12 dòng, trễ 25ms): đã có và ổn.
- **Chuyển trang** giữa Home, Book, Search, Shelf: không cần.
- **Vuốt trên hàng trích** để xoá, chọn hay mở menu: đụng với cuộn và nhấn
  giữ (đã có menu bằng nhấn giữ và chuột phải).
- **Animate chiều cao** của Outline hay danh sách.
- **Kệ sách** (`ShelfView`): đã có chuyển động riêng (`transition-transform`
  trên từng hàng). Đọc nó trước, đừng thêm chồng lên.
- **Bỏ typewriter** hay đổi nó: đã có, đã tôn trọng reduced motion.
- **Rung** thêm ngoài rung 8ms khi nhấn giữ đã có.

## Tiến độ

(AI làm ghi một dòng mỗi phase: ngày, commit, ghi chú.)
