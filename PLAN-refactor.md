# PLAN-refactor (legi)

Trạng thái: Phase 1 và 2 xong (2026-11-15). Test 89/89, build OK. Chưa thử bằng tay trên app thật.

Mục tiêu nhỏ: bỏ lệnh gọi Firebase khỏi 4 component. Gom các lệnh gọi Cloud Function vào một file.

Không đổi tính năng. Không đổi giao diện.

## Nguyên tắc chung

- Hỏi owner trước khi bắt đầu. Một hoặc hai commit.
- Trước và sau: `npm test`, `npm run test:rules`, `npm run build`.
- Chỉ di chuyển code.

## Hiện trạng

| File | Gọi trực tiếp |
|---|---|
| `components/VoiceButton.tsx` | `httpsCallable(..., 'transcribe')` |
| `components/Outline.tsx` | `httpsCallable(..., 'tocFromVoice')` |
| `components/CaptureView.tsx` | `httpsCallable(..., 'extractPage')` |
| `components/HomeView.tsx` | `onSnapshot(doc(users/{uid}/daily/{day}))` |

Ghi dữ liệu đã đi qua `lib/repo.ts`. Chỉ còn 4 chỗ trên.

## Phase 1: gom Cloud Function vào `lib/ai.ts`

1. Tạo `src/lib/ai.ts` (giống cách hodi làm):
   - `transcribe(audio, mimeType)`
   - `tocFromVoice(audio, mimeType, outline)`
   - `extractPage(images, mode)`
   Giữ nguyên `timeout` của từng hàm.
2. Ba component gọi hàm trong `lib/ai.ts`.
3. Kiểu dữ liệu trả về (`TocItem`, `PageResult`) để trong `types/`.

## Phase 2: đọc daily qua repo

1. Thêm `watchDaily(uid, day, onChange)` vào `lib/repo.ts` (hoặc `lib/daily.ts` đã có). Trả về hàm huỷ.
2. `HomeView.tsx` dùng hàm này.

Xong khi: `grep -E "firebase/(firestore|functions)" src/components` không còn kết quả.

## Để sau

`components/Composer.tsx` (572 dòng) và `Outline.tsx` (455 dòng) hơi to. Chỉ tách khi sắp thêm tính năng ở đó. Ví dụ: tách phần draft + dán chữ của Composer thành hook `useComposerDraft`.
