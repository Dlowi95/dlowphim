# Báo Cáo Sửa Đổi: Chuẩn Hóa Nhận Diện Nút Tập Phim Bằng `data-episode-index` & Khôi Phục Focus Sau Popup Cảnh Báo

## 1. Phạm Vi & Bối Cảnh (Scope & Baseline)
- **Repository**: `D:\dlowphim`
- **Mục tiêu**:
  1. **Khắc phục triệt để lỗi so sánh chuỗi tên tập khi khôi phục focus**: Loại bỏ việc dựa vào display text ("Tập 2" vs "2") dễ gây sai lệch do tiền tố; chuyển sang dùng thuộc tính định danh DOM ổn định `data-episode-index={globalIdx}` trực tiếp trên các nút tập phim của `EpisodeSelector`.
  2. **Khôi phục focus chính xác và an toàn**:
     - Khi khách bấm tập phim: Lưu `lastEpisodeIdxRef` và truy vấn chính xác `button[data-episode-index="${idx}"]` trong container `episodeSelectorContainerRef` (hoạt động đúng cả khi click chạm trên mobile Safari không tự gán `activeElement`).
     - Khi đóng popup (bằng nút "Đã hiểu", phím `Escape` hoặc backdrop): Focus trả về đúng nút tập phim đã kích hoạt.
     - Nếu nút đã unmount: Tìm lại nút theo `button[data-episode-index="${idx}"]` trong container hoặc fallback về nút đầu tiên trong vùng chọn tập, **tuyệt đối không quét ra ngoài `document.body`**.
  3. **Bảo toàn phân quyền & tính năng**: Khách tuyệt đối không được đổi tập phim (không emit `change_episode`, không đổi `activeEpisodeIndex` hay video source).

---

## 2. Danh Sách Tệp Thay Đổi (Files Changed)
- [frontend/src/components/EpisodeSelector.tsx](file:///d:/dlowphim/frontend/src/components/EpisodeSelector.tsx):
  - L85: Thêm thuộc tính định danh ổn định `data-episode-index={globalIdx}` vào thẻ `<button>` của từng tập phim.
- [frontend/src/app/watch-together/room/[roomId]/page.tsx](file:///d:/dlowphim/frontend/src/app/watch-together/room/%5BroomId%5D/page.tsx):
  - L143-L168: Sửa `closeCannotChangeEpisodeModal` sử dụng `container.querySelector('button[data-episode-index="..."]')` thay vì so sánh text.
  - L2166-L2178: Trong `onSelectEpisode(idx)`, tìm trực tiếp `targetBtn = container?.querySelector('button[data-episode-index="${idx}"]')` và lưu vào `lastTriggerElementRef`.
- [frontend/src/utils/watchTogetherFlow.test.ts](file:///d:/dlowphim/frontend/src/utils/watchTogetherFlow.test.ts):
  - Cập nhật test suite xác thực cơ chế tra cứu `data-episode-index` hoạt động chính xác 100% không phụ thuộc format text (`"2"`, `"Tập 2"`, `"12"`, `"20"`, v.v.).

---

## 3. Chi Tiết Nguyên Nhân & Cách Khắc Phục

### Nguyên Nhân Thực Tế
- Trong `page.tsx` trước đây:
  ```typescript
  const targetEpName = ep?.name ? String(ep.name).trim() : String(idx + 1);
  const normalizedText = text.replace(/^Tập\s+/i, "").trim();
  if (normalizedText === targetEpName) ...
  ```
  Khi dữ liệu tập phim từ API có `ep.name = "Tập 2"`:
  - `targetEpName` là `"Tập 2"`.
  - Button trên giao diện render text `"Tập 2"` $\rightarrow$ `normalizedText` thành `"2"`.
  - Phép so sánh `"2" === "Tập 2"` trả về `false`, khiến logic không tìm được nút Tập 2 và fallback nhầm về nút Tập 1.

### Cách Khắc Phục
1. **Thêm định danh `data-episode-index={globalIdx}`**:
   - Mỗi nút tập trong `EpisodeSelector.tsx` được gắn thuộc tính `data-episode-index={globalIdx}` tương ứng với index số nguyên của tập phim.
2. **Nhận diện nút khi kích hoạt**:
   - Trong `onSelectEpisode(idx)` của `RoomPage`:
     ```typescript
     const targetBtn = container?.querySelector<HTMLButtonElement>(`button[data-episode-index="${idx}"]`);
     lastTriggerElementRef.current = targetBtn || (document.activeElement instanceof HTMLElement && container?.contains(document.activeElement) ? document.activeElement : null);
     ```
   - Dù trên Safari mobile (chạm cảm ứng không làm nút trở thành `document.activeElement`), bộ chọn `button[data-episode-index="${idx}"]` vẫn trỏ chính xác $100\%$ vào element nút tập vừa bấm.
3. **Khôi phục focus khi đóng popup**:
   - Khi đóng modal:
     - Nếu `lastTriggerElementRef.current` còn trong DOM $\rightarrow$ `triggerEl.focus()`.
     - Nếu element đã bị unmount (ví dụ danh sách tập chuyển tab/batch) $\rightarrow$ tìm lại `container.querySelector('button[data-episode-index="${lastEpisodeIdxRef.current}"]')`.
     - Nếu không có $\rightarrow$ fallback an toàn về focusable đầu tiên bên trong container chọn tập, không quét ngoài `document.body`.

---

## 4. Bảng So Sánh Trước / Sau Bản Sửa

| Tình huống | Trước bản sửa | Sau bản sửa |
| :--- | :--- | :--- |
| **`Episode.name = "2"`** | Trả focus về Tập 2 | **Trả focus chính xác về Tập 2** |
| **`Episode.name = "Tập 2"`** | So sánh text trượt, fallback nhầm Tập 1 | **Khớp chính xác `data-episode-index="1"` $\rightarrow$ Trả focus về Tập 2** |
| **Tập 12, 20 & nút "2 người xem"** | Có rủi ro nhầm số "2" | **Index độc lập 100% (`0`, `1`, `11`, `19`), không bị ảnh hưởng** |
| **Touch trên Safari mobile (activeElement là body)** | Trả focus về body | **Truy vấn qua container $\rightarrow$ Trả focus về đúng nút tập vừa bấm** |
| **Nút tập bị unmount khi modal mở** | Quét `document` toàn cục | **Giới hạn bên trong container danh sách tập, fallback an toàn** |

---

## 5. Kết Quả Xác Minh & Bằng Chứng

### 5.1. Unit Test Runner (`npm run test:watch`)
```text
> frontend@0.1.0 test:watch
> node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test src/utils/episodeUtils.test.ts src/utils/watchPlaybackFlow.test.ts src/utils/watchTogetherFlow.test.ts

✔ normalizes common PhimAPI and OPhim episode labels (1.06ms)
✔ matches an OPhim episode when the active episode came from PhimAPI (0.16ms)
✔ matches a PhimAPI episode when the active episode came from OPhim (0.09ms)
✔ uses a valid fallback when providers genuinely have different episodes (0.07ms)
✔ restores the same episode and time after PhimAPI fails over to OPhim (0.79ms)
✔ prefetches only near the end and selects the normalized next episode (0.65ms)
✔ honors a temporary global CDN block but allows it again after expiry (0.15ms)
✔ uses the stable HLS release and bounds media recovery with an audio codec swap (0.47ms)
✔ Messenger-style Chat Matrix A/B/C: aligns messages strictly by viewer identity, not room role (1.13ms)
✔ two users with identical display names ('Sad nhân') are never confused (0.10ms)
✔ Unified Identity Lifecycle: assert ID_render === ID_join === msg.senderId under storage errors and reconnect (0.16ms)
✔ handles storage failure or missing IDs gracefully without crashing (0.07ms)
✔ system messages are never marked as self messages (0.15ms)
✔ groups continuous messages from the same sender within 60 seconds (0.18ms)
✔ resolves correct fullscreen action across desktop container vs iOS Safari native video (0.12ms)
✔ isNearBottom: detects whether chat scroll is within bottom threshold (0.08ms)
✔ shouldAutoScrollChat: preserves reader position when reading old messages, ignores user object re-renders without new messages (0.09ms)
✔ evaluateBatchAutoScroll MessageId & Session Lifecycle: MessageId matching, out-of-order ACK/Echo, session cleanup, same-account different devices (0.43ms)
✔ formatVietnamChatTime: formats time strictly in Asia/Ho_Chi_Minh 24h format (HH:mm) and rejects unverified strings (10.80ms)
✔ Session Lifecycle Isolation: Session teardown resets isSendingMessage and prevents stale callbacks from modifying new session (0.18ms)
✔ Episode Selection Button Lookup: uses stable data-episode-index to guarantee 100% accurate button identification regardless of name formatting (0.23ms)
ℹ tests 21 | suites 0 | pass 21 | fail 0 | duration_ms 114.46ms
```
**Kết quả**: **21/21 tests PASSED (100%)**.

### 5.2. TypeScript Typecheck (`npx tsc --noEmit`)
- **Kết quả**: 0 lỗi TypeScript (Exit code 0).

### 5.3. Next.js Production Build (`npm run build`)
- **Kết quả**: 21/21 routes build thành công (Exit code 0).
- `/watch-together/room/[roomId]`: Size 21.3 kB, First Load JS 127 kB.

### 5.4. Whitespace & Git Status (`git diff --check`)
- **Kết quả**: 0 lỗi format.

---

## 6. Trạng Thái Thực Nghiệm & Những Gì Chưa Kiểm Chứng (Remaining Risks)
- **Kiểm thử tự động & Build**: ✅ Đạt 100% test runner, typecheck và Next.js build.
- **Môi trường vật lý**: Hành vi khôi phục focus trên bàn phím ảo của thiết bị iPhone/iPad Safari thật cần được người dùng trải nghiệm thực tế để xác nhận cảm giác thao tác.

---

## 7. Trạng Thái Git Hiện Tại
```text
 M frontend/src/app/watch-together/create/[slug]/page.tsx
 M frontend/src/app/watch-together/page.tsx
 M frontend/src/app/watch-together/room/[roomId]/page.tsx
 M frontend/src/components/EpisodeSelector.tsx
 M frontend/src/utils/watchTogetherFlow.test.ts
 M frontend/src/utils/watchTogetherFlow.ts
```
*(Dừng lại để Codex review; KHÔNG commit, push hoặc deploy).*
