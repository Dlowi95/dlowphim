# Báo Cáo Sửa Đổi: Khắc Phục Guard Menu Ẩn Của Plyr & Phân Biệt Chính Xác Overlay Mở Cho Phím Tắt Desktop (/watch/[slug])

## 1. Phạm Vi & Bối Cảnh (Scope & Baseline)
- **Repository**: `D:\dlowphim`
- **Mục tiêu**:
  1. **Khắc phục lỗi phím tắt Desktop bị chặn vĩnh viễn do node menu ẩn của Plyr**:
     - Trong DOM của Plyr, các menu cài đặt (Quality, Speed, Captions) luôn tồn tại dưới dạng `<div role="menu" hidden>` hoặc nằm trong container ẩn.
     - Guard cũ dùng `document.querySelector("[role='menu']")` đã tìm thấy các phần tử ẩn này ngay cả khi menu chưa từng mở, khiến `handleSeekShortcut` luôn return và làm tê liệt phím `Space` và `ArrowLeft`/`ArrowRight` trên Desktop.
  2. **Phân biệt chính xác giữa Overlay đang mở với Node đang ẩn**:
     - Kiểm tra trạng thái React state của các modal/drawer (`showReportModal`, `showEpisodeDrawer`, `showMobileServerPicker`, `showPlaylistDropdown`, `isCreatingPlaylist`).
     - Kiểm tra menu Plyr chỉ khi nút cài đặt có `aria-expanded="true"` hoặc pane menu không có thuộc tính `hidden` (`.plyr__menu button[data-plyr='settings'][aria-expanded='true'], .plyr__menu [role='menu']:not([hidden])`).
     - Kiểm tra các dialog/modal chung chỉ khi không bị `hidden` và không bị `aria-hidden="true"`.
  3. **Thực thi và kiểm thử trực tiếp mã nguồn Production**:
     - Tách logic xác định overlay và phím tắt thành các hàm thuần túy `isWatchOverlayActive` và `evaluateWatchKeyboardShortcut` trong `frontend/src/utils/watchPlaybackFlow.ts`.
     - File test `frontend/src/utils/watchPlaybackFlow.test.ts` gọi trực tiếp các hàm production này để kiểm chứng các ma trận DOM thực tế.

---

## 2. Danh Sách Tệp Thay Đổi (Files Changed)
- [frontend/src/utils/watchPlaybackFlow.ts](file:///d:/dlowphim/frontend/src/utils/watchPlaybackFlow.ts):
  - L65-L175: Xuất khẩu hàm `isWatchOverlayActive` và `evaluateWatchKeyboardShortcut` phân biệt chính xác giữa overlay đang mở thực tế và các menu/dialog ẩn trong DOM.
- [frontend/src/app/watch/[slug]/page.tsx](file:///d:/dlowphim/frontend/src/app/watch/%5Bslug%5D/page.tsx):
  - L27-L35: Import `evaluateWatchKeyboardShortcut` từ `@/utils/watchPlaybackFlow`.
  - L938-L998: `handleSeekShortcut` sử dụng `evaluateWatchKeyboardShortcut` để xử lý tập trung, loại bỏ hoàn toàn selector query sai lệch.
- [frontend/src/utils/watchPlaybackFlow.test.ts](file:///d:/dlowphim/frontend/src/utils/watchPlaybackFlow.test.ts):
  - L5-L10: Import `evaluateWatchKeyboardShortcut` và `isWatchOverlayActive`.
  - L70-L175: Test suite kiểm thử trực tiếp mã nguồn production với ma trận DOM thực tế của Plyr (menu ẩn vs menu mở `aria-expanded="true"`, modal mở vs đóng, input vs button).

---

## 3. Chi Tiết Nguyên Nhân & Cách Khắc Phục

### Finding: Guard Kiểm Tra DOM Bị Kẹt Do Menu Ẩn Của Plyr
* **Nguyên nhân**:
  - Plyr render cấu trúc menu cài đặt sẵn trong DOM với thuộc tính `role="menu" hidden`.
  - Guard trước dùng:
    ```typescript
    document.querySelector("[role='dialog'], [role='menu'], [aria-modal='true'], ...")
    ```
  - Vì `document.querySelector("[role='menu']")` luôn trả về phần tử (dù nó có thuộc tính `hidden`), guard luôn coi là có menu đang mở và bỏ qua toàn bộ phím tắt.
* **Cách khắc phục**:
  - Trong `isWatchOverlayActive`:
    - Chỉ coi Plyr menu mở khi:
      ```typescript
      Boolean(doc.querySelector(".plyr__menu button[data-plyr='settings'][aria-expanded='true'], .plyr__menu [role='menu']:not([hidden])"))
      ```
    - Chỉ coi modal/dialog mở khi không bị `hidden` và không bị `aria-hidden="true"`:
      ```typescript
      Boolean(doc.querySelector("[role='dialog']:not([aria-hidden='true']):not([hidden]), [aria-modal='true']:not([aria-hidden='true']):not([hidden]), .modal:not(.hidden):not([aria-hidden='true'])"))
      ```
    - Kết hợp chặt chẽ với state của route (`showReportModal`, `showEpisodeDrawer`, ...).

---

## 4. Ma Trận Kiểm Thử Thực Tế (Test Matrix)

| Kịch bản | DOM / State | Kết quả mong đợi | Kết quả kiểm thử Production |
| :--- | :--- | :--- | :--- |
| **A. Plyr menu ẩn trong DOM** | `<div role="menu" hidden>` | Space toggle play/pause, Arrow tua +-5s | ✅ `action: "toggle-play"`, `shouldPreventDefault: true` |
| **B. Giữ phím Space (repeat)** | `event.repeat === true` | Chặn cuộn trang, không toggle lặp | ✅ `action: "ignore"`, `shouldPreventDefault: true` |
| **C. Plyr Settings menu đang mở** | `button[data-plyr='settings'][aria-expanded='true']` | Không điều khiển player, không chặn phím menu | ✅ `action: "ignore"`, `shouldPreventDefault: false` |
| **D. Modal báo lỗi đang mở** | `showReportModal = true` (focus ở body) | Không điều khiển player | ✅ `action: "ignore"`, `shouldPreventDefault: false` |
| **E. Đóng Modal báo lỗi** | `showReportModal = false` | Khôi phục Space và Arrow ngay lập tức | ✅ `action: "toggle-play"`, `shouldPreventDefault: true` |
| **F. Nhập text trong Input** | `target: <input>` | Cho phép gõ dấu cách, không chặn phím | ✅ `action: "ignore"`, `shouldPreventDefault: false` |
| **G. Focus vào Button** | `target: <button>` | Tránh double-toggle với native click | ✅ `action: "ignore"`, `shouldPreventDefault: false` |

---

## 5. Kết Quả Xác Minh & Bằng Chứng

### 5.1. Unit Test Runner (`npm run test:watch`)
```text
> frontend@0.1.0 test:watch
> node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test src/utils/episodeUtils.test.ts src/utils/watchPlaybackFlow.test.ts src/utils/watchTogetherFlow.test.ts

✔ normalizes common PhimAPI and OPhim episode labels (1.36ms)
✔ matches an OPhim episode when the active episode came from PhimAPI (0.29ms)
✔ matches a PhimAPI episode when the active episode came from OPhim (0.16ms)
✔ uses a valid fallback when providers genuinely have different episodes (0.13ms)
✔ restores the same episode and time after PhimAPI fails over to OPhim (0.86ms)
✔ prefetches only near the end and selects the normalized next episode (0.18ms)
✔ honors a temporary global CDN block but allows it again after expiry (0.16ms)
✔ uses the stable HLS release and bounds media recovery with an audio codec swap (0.58ms)
✔ Desktop Keyboard Shortcuts (Production Code): accurately distinguishes between open overlays and hidden Plyr/DOM menus (0.32ms)
✔ Mobile Gesture & Auto-Hide Lifecycle: background single-tap toggles controls, cancels pending tap on control click, holds on scrubber (0.25ms)
✔ Messenger-style Chat Matrix A/B/C: aligns messages strictly by viewer identity, not room role (1.18ms)
✔ two users with identical display names ('Sad nhân') are never confused (0.14ms)
✔ Unified Identity Lifecycle: assert ID_render === ID_join === msg.senderId under storage errors and reconnect (0.17ms)
✔ handles storage failure or missing IDs gracefully without crashing (0.08ms)
✔ system messages are never marked as self messages (0.10ms)
✔ groups continuous messages from the same sender within 60 seconds (0.14ms)
✔ resolves correct fullscreen action across desktop container vs iOS Safari native video (0.09ms)
✔ isNearBottom: detects whether chat scroll is within bottom threshold (0.07ms)
✔ shouldAutoScrollChat: preserves reader position when reading old messages, ignores user object re-renders without new messages (0.09ms)
✔ evaluateBatchAutoScroll MessageId & Session Lifecycle: MessageId matching, out-of-order ACK/Echo, session cleanup, same-account different devices (0.41ms)
✔ formatVietnamChatTime: formats time strictly in Asia/Ho_Chi_Minh 24h format (HH:mm) and rejects unverified strings (13.11ms)
✔ Session Lifecycle Isolation: Session teardown resets isSendingMessage and prevents stale callbacks from modifying new session (0.21ms)
✔ Episode Selection Button Lookup: uses stable data-episode-index to guarantee 100% accurate button identification regardless of name formatting (0.25ms)
ℹ tests 23 | suites 0 | pass 23 | fail 0 | cancelled 0 | skipped 0 | todo 0 | duration_ms 128.19ms
```
**Kết quả**: **23/23 tests PASSED (100%)**.

### 5.2. TypeScript Typecheck (`npx tsc --noEmit`)
- **Kết quả**: 0 lỗi TypeScript (Exit code 0).

### 5.3. Next.js Production Build (`npm run build`)
- **Kết quả**: 21/21 routes biên dịch thành công (Exit code 0).
- `/watch/[slug]`: Size 22.9 kB, First Load JS 148 kB.

### 5.4. Whitespace & Git Status (`git diff --check`)
- **Kết quả**: 0 lỗi format.

---

## 6. Trạng Thái Thực Nghiệm & Những Gì Chưa Kiểm Chứng (Remaining Risks)
- **Kiểm thử tự động & Build**: ✅ Đạt 100% test runner, typecheck và Next.js build.
- **Môi trường vật lý**: Cần kiểm thử trực tiếp trên các trình duyệt desktop khác nhau (Chrome, Safari, Firefox, Edge) ở các chế độ hiển thị: Khung thường, Chế độ Rạp (`dlowphim-cinema-mode`), và Toàn màn hình container để xác nhận trải nghiệm thực tế.

---

## 7. Trạng Thái Git Hiện Tại
```text
 M frontend/src/app/watch/[slug]/MobileWatchPlayerControls.tsx
 M frontend/src/app/watch/[slug]/page.tsx
 M frontend/src/utils/watchPlaybackFlow.test.ts
 M frontend/src/utils/watchPlaybackFlow.ts
```
*(Dừng lại để Codex review; KHÔNG commit, push hoặc deploy).*
