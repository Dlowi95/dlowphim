# Báo Cáo Sửa Đổi: Phím Tắt Space Desktop & Cử Chỉ Single-Tap/Double-Tap/Auto-Hide Trình Phát Mobile (/watch/[slug])

## 1. Phạm Vi & Bối Cảnh (Scope & Baseline)
- **Repository**: `D:\dlowphim`
- **Mục tiêu**:
  1. **Desktop Player: Bổ sung phím Space chuyển Play $\leftrightarrow$ Pause chuẩn mực**:
     - Khi xem phim bằng player HLS trên desktop, nhấn Space toggle play $\leftrightarrow$ pause đúng 1 lần.
     - Chặn cuộn trang (`preventDefault()`) chỉ khi thực sự xử lý phím tắt player.
     - Bảo vệ input người dùng: không chiếm Space khi focus trong `input`, `textarea`, `select`, `contenteditable`, `button` (để tránh double-toggle khi Space kích hoạt click native của button) hoặc trong menu/modal/dialog.
     - Bỏ qua khi phím bị giữ (`event.repeat`), giữ nguyên ArrowLeft/ArrowRight $\pm 5$s.
  2. **Mobile Player: Chạm nền video CHỈ bật/tắt controls**:
     - Chạm nền khi controls đang ẩn $\rightarrow$ hiện controls và bắt đầu đếm ngược tự ẩn.
     - Chạm nền khi controls đang hiện $\rightarrow$ ẩn controls ngay lập tức.
     - Chạm nền **tuyệt đối KHÔNG gọi play/pause**.
     - Nút hồng trung tâm là nút play/pause duy nhất và xử lý trực tiếp trong thao tác người dùng (không delay qua timer).
     - Xóa bỏ nút play/pause nhỏ bị trùng lặp ở thanh điều khiển dưới mobile.
  3. **Mobile Player: Sửa cơ chế Auto-hide Timer & Double-tap Seek**:
     - Double-tap bên trái: $-5$s; Double-tap bên phải: $+5$s (giới hạn $[0, \text{duration}]$).
     - Double-tap không kích hoạt single-tap hay làm pause phim.
     - Sửa lỗi timer không chạy lại khi tương tác trong lúc controls đang mở (`startAutoHideTimer()` luôn xóa timer cũ và lập mới 3000ms đếm ngược).
     - Tạm dừng phim thì giữ controls mở, không tự ẩn do timer cũ. Khi mở menu cài đặt/âm lượng thì không tự ẩn.
     - Dọn dẹp toàn bộ timer, pending tap và feedback khi unmount hoặc đổi tập.

---

## 2. Danh Sách Tệp Thay Đổi (Files Changed)
- [frontend/src/app/watch/[slug]/page.tsx](file:///d:/dlowphim/frontend/src/app/watch/%5Bslug%5D/page.tsx):
  - L937-L970: Cập nhật `handleSeekShortcut` hỗ trợ phím Space play/pause với đầy đủ guard chặn `event.repeat`, `input`, `textarea`, `select`, `contenteditable`, `button` và modal/dialog.
- [frontend/src/app/watch/[slug]/MobileWatchPlayerControls.tsx](file:///d:/dlowphim/frontend/src/app/watch/%5Bslug%5D/MobileWatchPlayerControls.tsx):
  - L129-L143: Khai báo `startAutoHideTimer`, `showControls`, `hideControls` quản lý vòng đời timer độc lập và tự khởi động lại sau mỗi tương tác.
  - L228-L235: `useEffect` đồng bộ auto-hide timer khi đang phát và không mở settings/volume.
  - L305-L325: `handleSurfacePointerUp` phân loại cử chỉ: center single-tap tức thì, left/right single-tap qua delay để phân biệt double-tap; chạm nền **chỉ toggle `controlsVisible`**, không gọi `togglePlayback()`.
  - L468-L485: Nút hồng trung tâm xử lý `togglePlayback()` trực tiếp, giữ controls và xóa timer khi chuyển sang pause.
  - L508-L555: Xóa bỏ nút play/pause nhỏ trùng lặp ở bottom bar; căn chỉnh thanh điều khiển thanh thoát, trực quan.
- [frontend/src/utils/watchPlaybackFlow.test.ts](file:///d:/dlowphim/frontend/src/utils/watchPlaybackFlow.test.ts):
  - Thêm 2 test suite lớn kiểm thử Desktop Space/Arrow shortcuts và Mobile Gesture & Auto-Hide Lifecycle.

---

## 3. Chi Tiết Nguyên Nhân & Cách Khắc Phục

### Finding 1: Desktop Player Thiếu Phím Tắt Space Play/Pause
* **Nguyên nhân**: Trong `page.tsx`, `handleSeekShortcut` chỉ xử lý `ArrowLeft`/`ArrowRight`. Plyr keyboard bị tắt (`keyboard: { focused: false, global: false }`) để tránh xung đột trên mobile, dẫn đến desktop không nhận phím Space.
* **Cách khắc phục**:
  - Bổ sung nhánh bắt `event.code === "Space" || event.key === " "` trong `handleSeekShortcut`.
  - Kiểm tra `event.repeat`, nếu phím bị đè giữ thì return ngay.
  - Kiểm tra `target`: nếu đang focus vào `INPUT`, `TEXTAREA`, `SELECT`, `BUTTON`, `contenteditable`, hoặc nằm trong `dialog`/`modal`/`menu` thì return và không gọi `preventDefault()` để cho phép người dùng thao tác form hoặc kích hoạt nút bình thường.
  - Nếu hợp lệ: gọi `event.preventDefault()` (chặn cuộn trang) và `plyrRef.current.togglePlay()` hoặc `video.paused ? video.play() : video.pause()`.

### Finding 2: Chạm Nền Mobile Làm Tạm Dừng Phim Thay Vì Ẩn/Hiện Controls
* **Nguyên nhân**: Trong `handleSurfacePointerUp` trước đây, single-tap timer hết hạn sẽ gọi `togglePlayback()`, dẫn đến việc người dùng chạm vào màn hình chỉ để xem thời gian thì video lại bị dừng.
* **Cách khắc phục**:
  - Single-tap trên bề mặt video chuyển thành:
    - Nếu controls đang hiện $\rightarrow$ gọi `hideControls()` (ẩn controls ngay lập tức).
    - Nếu controls đang ẩn $\rightarrow$ gọi `showControls()` (hiện controls và bắt đầu đếm ngược 3s tự ẩn).
  - Không gọi `togglePlayback()` từ background tap.
  - Người dùng muốn play/pause sẽ chạm vào nút hồng lớn ở chính giữa video. Nút hồng xử lý trực tiếp không qua timer delay.
  - Xóa bỏ nút play/pause nhỏ ở góc dưới bên trái thanh controls để tránh nhầm lẫn.

### Finding 3: Double-Tap và Tương Tác Khi Controls Đang Mở Không Reset Auto-Hide Timer
* **Nguyên nhân**: `useEffect` quản lý auto-hide trước đây chỉ chạy lại khi dependency thay đổi. Khi controls đã `true` và người dùng double-tap tua phim, `showControls` gọi `clearHideTimer()` nhưng `useEffect` không re-run, khiến timer bị xóa vĩnh viễn và controls không bao giờ tự ẩn lại.
* **Cách khắc phục**:
  - Tạo hàm `startAutoHideTimer` chuẩn:
    ```typescript
    const startAutoHideTimer = useCallback(() => {
      clearHideTimer();
      if (isPlaying && !settingsView && !volumeOpen) {
        hideTimerRef.current = setTimeout(() => {
          setControlsVisible(false);
        }, CONTROLS_HIDE_DELAY_MS);
      }
    }, [clearHideTimer, isPlaying, settingsView, volumeOpen]);
    ```
  - Mọi thao tác tương tác (`showControls()`, double-tap `seekBy()`, kéo tua tiến trình `handleSeek()`) đều kích hoạt `startAutoHideTimer()`, đảm bảo luôn có một phiên đếm ngược 3000ms mới được thiết lập.
  - Khi video pause (bấm nút hồng): `isPlaying` thành `false`, `clearHideTimer()` được gọi và controls giữ nguyên không tự biến mất.

---

## 4. Bảng So Sánh Trước / Sau Bản Sửa

| Tình huống kiểm thử | Trước bản sửa | Sau bản sửa |
| :--- | :--- | :--- |
| **Desktop: Nhấn Space khi xem phim** | Cuộn trang xuống dưới, không pause | **Play $\leftrightarrow$ Pause ngay lập tức, chặn cuộn trang** |
| **Desktop: Nhấn Space khi gõ bình luận** | Có thể bị player chiếm hoặc giật | **Gõ dấu cách bình thường trong ô text** |
| **Desktop: Nhấn Space khi focus vào nút** | Có nguy cơ toggle 2 lần | **Bỏ qua shortcut, nút xử lý click native đúng 1 lần** |
| **Mobile: Chạm nền video khi controls đang hiện** | Phim bị tạm dừng (pause) | **Ẩn controls, video tiếp tục phát bình thường** |
| **Mobile: Chạm nền video khi controls đang ẩn** | Hiện controls | **Hiện controls và bắt đầu đếm ngược 3s tự ẩn** |
| **Mobile: Double-tap khi controls đang hiện** | Tua +5s nhưng controls không bao giờ tự ẩn | **Tua +5s và controls tự động ẩn sau 3 giây** |
| **Mobile: Tạm dừng bằng nút hồng** | Bị timer cũ làm ẩn controls | **Controls giữ nguyên hiển thị, hủy timer tự ẩn** |

---

## 5. Kết Quả Kiểm Thử & Xác Minh

### 5.1. Unit Test Runner (`npm run test:watch`)
```text
> frontend@0.1.0 test:watch
> node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test src/utils/episodeUtils.test.ts src/utils/watchPlaybackFlow.test.ts src/utils/watchTogetherFlow.test.ts

✔ normalizes common PhimAPI and OPhim episode labels (1.11ms)
✔ matches an OPhim episode when the active episode came from PhimAPI (0.18ms)
✔ matches a PhimAPI episode when the active episode came from OPhim (0.12ms)
✔ uses a valid fallback when providers genuinely have different episodes (0.08ms)
✔ restores the same episode and time after PhimAPI fails over to OPhim (0.88ms)
✔ prefetches only near the end and selects the normalized next episode (0.17ms)
✔ honors a temporary global CDN block but allows it again after expiry (0.15ms)
✔ Desktop Keyboard Shortcuts: Space toggles play/pause and Arrow keys seek +-5s with proper guards (0.22ms)
✔ Mobile Gesture & Auto-Hide Lifecycle: background single-tap toggles controls, pink button plays/pauses, double-tap seeks without pause (0.15ms)
✔ Messenger-style Chat Matrix A/B/C: aligns messages strictly by viewer identity, not room role (1.16ms)
✔ two users with identical display names ('Sad nhân') are never confused (0.12ms)
✔ Unified Identity Lifecycle: assert ID_render === ID_join === msg.senderId under storage errors and reconnect (0.18ms)
✔ handles storage failure or missing IDs gracefully without crashing (0.09ms)
✔ system messages are never marked as self messages (0.10ms)
✔ groups continuous messages from the same sender within 60 seconds (0.15ms)
✔ resolves correct fullscreen action across desktop container vs iOS Safari native video (0.08ms)
✔ isNearBottom: detects whether chat scroll is within bottom threshold (0.09ms)
✔ shouldAutoScrollChat: preserves reader position when reading old messages, ignores user object re-renders without new messages (0.09ms)
✔ evaluateBatchAutoScroll MessageId & Session Lifecycle: MessageId matching, out-of-order ACK/Echo, session cleanup, same-account different devices (0.42ms)
✔ formatVietnamChatTime: formats time strictly in Asia/Ho_Chi_Minh 24h format (HH:mm) and rejects unverified strings (11.82ms)
✔ Session Lifecycle Isolation: Session teardown resets isSendingMessage and prevents stale callbacks from modifying new session (0.20ms)
✔ Episode Selection Button Lookup: uses stable data-episode-index to guarantee 100% accurate button identification regardless of name formatting (0.23ms)
ℹ tests 22 | suites 0 | pass 22 | fail 0 | cancelled 0 | skipped 0 | todo 0 | duration_ms 118.07ms
```
**Kết quả**: **22/22 tests PASSED (100%)**.

### 5.2. TypeScript Typecheck (`npx tsc --noEmit`)
- **Kết quả**: 0 lỗi TypeScript (Exit code 0).

### 5.3. Next.js Production Build (`npm run build`)
- **Kết quả**: 21/21 routes biên dịch thành công (Exit code 0).
- `/watch/[slug]`: Size 22.5 kB, First Load JS 148 kB.

### 5.4. Whitespace & Git Status (`git diff --check`)
- **Kết quả**: 0 lỗi format.

---

## 6. Trạng Thái Thực Nghiệm & Những Gì Chưa Kiểm Chứng (Remaining Risks)
- **Kiểm thử tự động & Build**: ✅ Đạt 100% test runner, typecheck và Next.js build.
- **Môi trường vật lý**: Cần kiểm thử trực tiếp trên thiết bị iPhone/iPad Safari thật và Android Chrome để đánh giá độ nhạy chạm thực tế khi double-tap nhanh trên các kích thước màn hình khác nhau.

---

## 7. Trạng Thái Git Hiện Tại
```text
 M frontend/src/app/watch/[slug]/MobileWatchPlayerControls.tsx
 M frontend/src/app/watch/[slug]/page.tsx
 M frontend/src/utils/watchPlaybackFlow.test.ts
```
*(Dừng lại để Codex review; KHÔNG commit, push hoặc deploy).*
