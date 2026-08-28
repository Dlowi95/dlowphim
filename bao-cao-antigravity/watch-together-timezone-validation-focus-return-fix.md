# Báo Cáo Sửa Đổi: Xác Thực Múi Giờ Chặt Chẽ Timestamp & Chuẩn Hóa Khôi Phục Focus Modal Chọn Tập

## 1. Phạm Vi & Bối Cảnh (Scope & Baseline)
- **Repository**: `D:\dlowphim`
- **Mục tiêu**:
  1. **Khắc phục triệt để lỗi parse timestamp thiếu timezone (Finding 1)**: Chỉ parse chuỗi timestamp có định dạng chuẩn kèm timezone rõ ràng (`Z` hoặc offset `+HH:MM`/`-HH:MM`). Chuỗi thiếu timezone, chỉ có ngày hoặc không rõ múi giờ sẽ trả về chuỗi rỗng `""` và ẩn hoàn toàn giờ cùng dấu chấm phân cách; không tự parse bằng `new Date(string)` để tránh việc cùng 1 chuỗi bị hiểu khác nhau giữa môi trường UTC, Asia/Ho_Chi_Minh và America/New_York.
  2. **Chuẩn hóa khôi phục focus về đúng nút tập phim (Finding 2)**: Gán `episodeSelectorContainerRef` bao bọc vùng chọn tập. Khi khách click/touch tập phim, lưu lại index và truy vấn chính xác nút tập theo tên tập chuẩn (`targetEpName`). Khi đóng modal, nếu nút unmount, tìm lại chính xác trong container hoặc fallback an toàn về nút đầu tiên của container mà **không bao giờ** quét toàn `document.body` hay chọn nhầm các nút chứa số như "Tập 12", "Tập 20" hoặc "2 người xem".
- **Phạm vi đóng băng (Frozen Scope)**:
  - Giữ nguyên 100% route `/watch`.
  - Giữ nguyên cơ chế Messenger chat alignment, `messageId` echo matching, WebKit Fullscreen iOS Safari, HLS player logic và socket protocol.
  - Không tạo thêm socket/listener/timer trùng lặp.
  - Không commit, không push, không deploy.

---

## 2. Danh Sách Tệp Thay Đổi (Files Changed)
- [frontend/src/utils/watchTogetherFlow.ts](file:///d:/dlowphim/frontend/src/utils/watchTogetherFlow.ts):
  - L47-L115: Thêm biểu thức chính quy `ISO_WITH_EXPLICIT_TIMEZONE_REGEX` và cập nhật `formatVietnamChatTime` chỉ chấp nhận chuỗi ISO có `Z`/offset, `Date` instance hoặc epoch ms (`number`).
- [frontend/src/app/watch-together/room/[roomId]/page.tsx](file:///d:/dlowphim/frontend/src/app/watch-together/room/%5BroomId%5D/page.tsx):
  - L139: Khai báo `episodeSelectorContainerRef = useRef<HTMLDivElement | null>(null)`.
  - L141-L175: Hoàn thiện `closeCannotChangeEpisodeModal` khôi phục focus giới hạn bên trong `episodeSelectorContainerRef`, phân biệt chính xác tên tập.
  - L2165: Gắn `ref={episodeSelectorContainerRef}` vào thẻ cha của `EpisodeSelector`.
  - L2174-L2195: Khi khách bấm tập, tìm chính xác phần tử button tương ứng trong `episodeSelectorContainerRef` và lưu vào `lastTriggerElementRef`.
- [frontend/src/utils/watchTogetherFlow.test.ts](file:///d:/dlowphim/frontend/src/utils/watchTogetherFlow.test.ts):
  - Cập nhật test suite cho `formatVietnamChatTime` kiểm tra chuỗi có Z, có offset, thiếu timezone, date-only, fallbackTime không rõ timezone, Date, epoch ms.
  - Thêm test case matching nút tập phim cô lập tập 2 khỏi tập 12, 20, batch tabs và badge "2 người xem".

---

## 3. Chi Tiết Nguyên Nhân & Cách Khắc Phục

### Finding 1: Chuỗi Timestamp Thiếu Timezone Bị Parse Khác Nhau Theo Môi Trường
* **Nguyên nhân thực tế**:
  - Khi gọi `new Date("2026-08-28T03:42:00")` (không có `Z` hoặc offset), JavaScript engine tự động hiểu đây là thời gian địa phương của máy chủ/môi trường đang chạy (`local time`).
  - Dẫn đến việc cùng một chuỗi đầu vào:
    - Tại máy chủ UTC $\rightarrow$ hiểu là UTC 03:42 $\rightarrow$ format VN ra `10:42`.
    - Tại máy chủ VN $\rightarrow$ hiểu là VN 03:42 $\rightarrow$ format VN ra `03:42`.
    - Tại máy chủ NY $\rightarrow$ hiểu là NY 03:42 $\rightarrow$ format VN ra `14:42`.
* **Cách khắc phục**:
  - Sử dụng regex kiểm tra timezone tường minh:
    ```typescript
    const ISO_WITH_EXPLICIT_TIMEZONE_REGEX = /^\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:[zZ]|[+-]\d{2}(?::?\d{2})?)$/;
    ```
  - Trong `formatVietnamChatTime`:
    - Chỉ parse chuỗi nếu thỏa mãn `ISO_WITH_EXPLICIT_TIMEZONE_REGEX.test(trimmed)`.
    - Chuỗi không có timezone (như `"2026-08-28T03:42:00"`), chuỗi chỉ có ngày (`"2026-08-28"`), hoặc `fallbackTime` không rõ timezone (như `"03:42 AM"`) đều trả về chuỗi rỗng `""`.
    - Khi `displayTime` rỗng, giao diện ẩn hoàn toàn dấu chấm đệm `•` và giờ gửi, không bao giờ hiển thị giờ phỏng đoán.
  - Hỗ trợ đầy đủ:
    - ISO với `Z`/`z` (`2026-08-28T03:42:00.000Z` $\rightarrow$ `10:42`).
    - ISO với offset (`2026-08-28T10:42:00+07:00` $\rightarrow$ `10:42`).
    - Date instance hợp lệ (`new Date("2026-08-28T03:42:00Z")` $\rightarrow$ `10:42`).
    - Epoch milliseconds UTC number (`1787888520000` $\rightarrow$ `10:42`).

### Finding 2: Khôi Phục Focus Sai Khi Nút Tập Chưa Nhận Focus Hoặc Đã Unmount
* **Nguyên nhân thực tế**:
  - Trên Safari mobile (chạm cảm ứng), `document.activeElement` không được cập nhật về nút tập mà vẫn giữ `document.body` hoặc phần tử trước đó.
  - Logic fallback trước đây quét toàn bộ `document.querySelectorAll('button')` và dùng `includes(String(index + 1))`, dẫn đến việc khi index=1 (tập 2), logic tìm nhầm các nút chứa số "2" như nút badge `"2 người xem"`, `"Tập 12"`, hoặc `"Tập 20"`.
* **Cách khắc phục**:
  - Gắn `ref={episodeSelectorContainerRef}` cố định trên container chứa danh sách tập phim.
  - Khi khách kích hoạt `onSelectEpisode(idx)`:
    - Lấy tên tập mục tiêu `targetEpName = episodes[idx]?.name || String(idx + 1)`.
    - Quét các button bên trong `episodeSelectorContainerRef.current` và so sánh chính xác:
      `text.replace(/^Tập\s+/i, '').trim() === targetEpName`.
    - Lưu trực tiếp element tìm được vào `lastTriggerElementRef.current`.
  - Khi đóng modal:
    - Nếu `lastTriggerElementRef.current` vẫn còn trong DOM $\rightarrow$ `triggerEl.focus()`.
    - Nếu `lastTriggerElementRef.current` đã unmount $\rightarrow$ tìm lại chính xác trong `episodeSelectorContainerRef.current` theo `targetEpName`.
    - Nếu không tìm thấy $\rightarrow$ fallback an toàn về focusable đầu tiên bên trong container chọn tập, tuyệt đối không quét ra ngoài `document.body`.

---

## 4. Bảng So Sánh Trước / Sau Bản Sửa

| Tình huống kiểm thử | Trước bản sửa | Sau bản sửa |
| :--- | :--- | :--- |
| **Chuỗi timestamp không có timezone (`2026-08-28T03:42:00`)** | Bị parse theo timezone máy chủ (UTC: 10:42, VN: 03:42, NY: 14:42) | **Bị từ chối đồng nhất ở mọi môi trường (`""`), ẩn giờ an toàn** |
| **Chuỗi chỉ có ngày (`2026-08-28`)** | Parse ra ngày không rõ giờ | **Trả về `""`** |
| **`fallbackTime` không rõ timezone (`03:42 AM`)** | Hiển thị chuỗi không xác minh | **Trả về `""`** |
| **Touch tập 2 trên Safari (activeElement là body)** | Trả focus về body | **Khớp chính xác nút "Tập 2" trong container và trả focus về nút** |
| **Nút tập 2 unmount, có nút "2 người xem" & "Tập 12"** | Focus nhầm vào "2 người xem" hoặc "Tập 12" | **Phân biệt chính xác "2" với "12", "20" và "2 người xem", không quét ngoài container** |

---

## 5. Kết Quả Kiểm Thử & Xác Minh

### 5.1. Unit Test Runner (`npm run test:watch`)
```text
> frontend@0.1.0 test:watch
> node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test src/utils/episodeUtils.test.ts src/utils/watchPlaybackFlow.test.ts src/utils/watchTogetherFlow.test.ts

✔ normalizes common PhimAPI and OPhim episode labels (1.07ms)
✔ matches an OPhim episode when the active episode came from PhimAPI (0.19ms)
✔ matches a PhimAPI episode when the active episode came from OPhim (0.09ms)
✔ uses a valid fallback when providers genuinely have different episodes (0.07ms)
✔ restores the same episode and time after PhimAPI fails over to OPhim (0.96ms)
✔ prefetches only near the end and selects the normalized next episode (0.98ms)
✔ honors a temporary global CDN block but allows it again after expiry (0.22ms)
✔ uses the stable HLS release and bounds media recovery with an audio codec swap (0.57ms)
✔ Messenger-style Chat Matrix A/B/C: aligns messages strictly by viewer identity, not room role (1.37ms)
✔ two users with identical display names ('Sad nhân') are never confused (0.12ms)
✔ Unified Identity Lifecycle: assert ID_render === ID_join === msg.senderId under storage errors and reconnect (0.29ms)
✔ handles storage failure or missing IDs gracefully without crashing (0.18ms)
✔ system messages are never marked as self messages (0.18ms)
✔ groups continuous messages from the same sender within 60 seconds (0.18ms)
✔ resolves correct fullscreen action across desktop container vs iOS Safari native video (0.13ms)
✔ isNearBottom: detects whether chat scroll is within bottom threshold (0.09ms)
✔ shouldAutoScrollChat: preserves reader position when reading old messages, ignores user object re-renders without new messages (0.10ms)
✔ evaluateBatchAutoScroll MessageId & Session Lifecycle: MessageId matching, out-of-order ACK/Echo, session cleanup, same-account different devices (0.48ms)
✔ formatVietnamChatTime: formats time strictly in Asia/Ho_Chi_Minh 24h format (HH:mm) and rejects unverified strings (11.57ms)
✔ Session Lifecycle Isolation: Session teardown resets isSendingMessage and prevents stale callbacks from modifying new session (0.18ms)
✔ Episode Selection Button Matching: strictly isolates episode 2 from 12, 20, batch tabs, and viewer counts (0.24ms)
ℹ tests 21 | suites 0 | pass 21 | fail 0 | cancelled 0 | skipped 0 | todo 0 | duration_ms 121.57ms
```
**Kết quả**: **21/21 tests PASSED** (100%).

### 5.2. TypeScript Typecheck (`npx tsc --noEmit`)
- **Kết quả**: 0 lỗi TypeScript (Exit code 0).

### 5.3. Next.js Production Build (`npm run build`)
- **Kết quả**: 21/21 routes biên dịch thành công (Exit code 0).
- `/watch-together/room/[roomId]`: Size 21.4 kB, First Load JS 128 kB.

### 5.4. Kiểm Tra Whitespace (`git diff --check`)
- **Kết quả**: 0 lỗi format / whitespace.

---

## 6. Quyền Sở Hữu Dữ Liệu & Socket (Ownership Verification)
- Toàn bộ cơ chế timezone validation và button matching được thực hiện hoàn toàn độc lập, an toàn tại frontend presentation layer.
- Giữ nguyên 100% backend gateway logic và socket protocol.

---

## 7. Rủi Ro Còn Lại & Trạng Thái Thực Nghiệm (Remaining Risks)
- **Kiểm thử tự động & Build**: ✅ Đạt 100% typecheck, test runner và Next.js build.
- **Môi trường vật lý**: Cần kiểm thử trực tiếp trên thiết bị iOS Safari thật và Android Chrome để đánh giá cảm ứng thực tế khi bấm tập phim.

---

## 8. Trạng Thái Git Hiện Tại
```text
 M frontend/src/app/watch-together/create/[slug]/page.tsx
 M frontend/src/app/watch-together/page.tsx
 M frontend/src/app/watch-together/room/[roomId]/page.tsx
 M frontend/src/utils/watchTogetherFlow.test.ts
 M frontend/src/utils/watchTogetherFlow.ts
```
*(Dừng lại để Codex review; KHÔNG commit, push hoặc deploy).*
