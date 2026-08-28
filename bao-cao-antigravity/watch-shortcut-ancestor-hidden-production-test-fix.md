# Báo Cáo Sửa Đổi: Khắc Phục Triệt Để Guard Ancestor Hidden, Đồng Bộ Trạng Thái Plyr Thực & Kiểm Thử Playwright E2E DOM Thật (/watch/[slug])

## 1. Phạm Vi & Bối Cảnh (Scope & Baseline)
- **Repository**: `D:\dlowphim`
- **Mục tiêu**:
  1. **Khắc phục lỗi nhận nhầm menu Plyr / dialog nằm dưới ancestor có `hidden` hoặc `aria-hidden="true"`**:
     - Trong DOM thực của Plyr (`plyr.js`), các menu pane cài đặt (Quality, Speed) `<div role="menu">` không có thuộc tính `hidden` trực tiếp trên chính nó, mà nằm trong container cha `<div class="plyr__menu" hidden>`. Bộ chọn CSS `:not([hidden])` chỉ kiểm tra node cục bộ nên vẫn match.
     - Triển khai hàm `isElementEffectivelyVisible(element)` duyệt ngược toàn bộ cây cha (ancestor tree) lên đến `documentElement` để phát hiện bất kỳ cấp cha nào có `hidden`, `aria-hidden="true"`, `class="hidden"` hoặc `display: none`.
  2. **Dựa vào trạng thái mở thực tế của Plyr (`aria-expanded="true"` / `.plyr--menu-open`)**:
     - Khi Plyr mở settings: nút điều khiển có `aria-expanded="true"` và container player nhận class `plyr--menu-open`.
     - Khi Plyr đóng settings: nút có `aria-expanded="false"`, container không có `plyr--menu-open`, và container menu nhận thuộc tính `hidden`.
  3. **Kiểm thử trực tiếp trên Trình Duyệt Thật (Playwright E2E với Plyr Thật)**:
     - Tạo file kiểm thử E2E thật [frontend/e2e/watch-keyboard.spec.ts](file:///d:/dlowphim/frontend/e2e/watch-keyboard.spec.ts) chạy Chromium render Plyr và route `/watch/[slug]` trực tiếp.

---

## 2. Danh Sách Tệp Thay Đổi (Files Changed)
- [frontend/src/utils/watchPlaybackFlow.ts](file:///d:/dlowphim/frontend/src/utils/watchPlaybackFlow.ts):
  - L73-L108: Viết hàm `isElementEffectivelyVisible(element)` kiểm tra đệ quy toàn bộ ancestor tree.
  - L110-L150: Cập nhật `isWatchOverlayActive` chỉ bắt Plyr settings khi nút có `aria-expanded="true"` hoặc container có `.plyr--menu-open`, và kiểm tra tính hiển thị hiệu lực của tất cả modal/dialog trong DOM.
- [frontend/src/app/watch/[slug]/page.tsx](file:///d:/dlowphim/frontend/src/app/watch/%5Bslug%5D/page.tsx):
  - L27-L35: Import `evaluateWatchKeyboardShortcut`.
  - L938-L985: `handleSeekShortcut` ủy quyền toàn bộ cho `evaluateWatchKeyboardShortcut`.
- [frontend/src/utils/watchPlaybackFlow.test.ts](file:///d:/dlowphim/frontend/src/utils/watchPlaybackFlow.test.ts):
  - L71-L175: Test suite mô phỏng cấu trúc cây ancestor lồng nhau thực tế của Plyr và dialog để kiểm tra `isWatchOverlayActive`.
- [frontend/e2e/watch-keyboard.spec.ts](file:///d:/dlowphim/frontend/e2e/watch-keyboard.spec.ts):
  - Toàn bộ kịch bản E2E thật chạy trên Chromium với Plyr production DOM.

---

## 3. Chi Tiết Kỹ Thuật & Cấu Trúc DOM Plyr Thực Tế

### 3.1. Cấu Trúc DOM Plyr Thực Tế
```html
<div class="plyr plyr--video ...">
  <!-- Controls bar -->
  <div class="plyr__controls">
    <!-- Nút mở Settings -->
    <div class="plyr__menu">
      <button type="button" class="plyr__control" data-plyr="settings" aria-haspopup="true" aria-expanded="false" aria-pressed="false">
        <svg>...</svg>
      </button>
      <!-- Container chứa các menu cài đặt: MẶC ĐỊNH CÓ THUỘC TÍNH hidden -->
      <div class="plyr__menu__container" hidden>
        <div>
          <!-- Các pane menu con bên trong KHÔNG có hidden trên chính nó -->
          <div role="menu">
            <button type="button" role="menuitem" data-plyr="settings">Chất lượng</button>
            <button type="button" role="menuitem" data-plyr="settings">Tốc độ</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
```

### 3.2. Vì Sao Guard Cũ Bị Lỗi?
- Khi query `.plyr__menu [role='menu']:not([hidden])`, trình duyệt tìm thấy thẻ `<div role="menu">` vì bản thân thẻ này không có thuộc tính `hidden` (thuộc tính `hidden` nằm ở thẻ cha `.plyr__menu__container`).
- Kết quả là `isWatchOverlayActive` luôn trả về `true` ngay khi khởi tạo Plyr.

### 3.3. Giải Pháp Hoàn Thiện
1. **Kiểm tra trạng thái Plyr**:
   ```typescript
   const plyrSettingsOpen = doc.querySelector(
     ".plyr.plyr--menu-open, .plyr button[data-plyr='settings'][aria-expanded='true']",
   );
   if (plyrSettingsOpen && isElementEffectivelyVisible(plyrSettingsOpen as HTMLElement)) {
     return true;
   }
   ```
2. **Kiểm tra ancestor visibility**:
   ```typescript
   export function isElementEffectivelyVisible(element: HTMLElement | null): boolean {
     if (!element) return false;
     let current: HTMLElement | null = element;
     const root = element.ownerDocument?.documentElement;

     while (current && current !== root && current.nodeType === 1) {
       if (
         current.hasAttribute("hidden") ||
         current.getAttribute("aria-hidden") === "true" ||
         current.classList?.contains("hidden")
       ) {
         return false;
       }
       if (typeof window !== "undefined" && typeof window.getComputedStyle === "function") {
         try {
           const style = window.getComputedStyle(current);
           if (style.display === "none" || style.visibility === "hidden") return false;
         } catch { }
       }
       current = current.parentElement;
     }
     return true;
   }
   ```

---

## 4. Kết Quả Xác Minh Bằng Chứng (Verification Evidence)

### 4.1. Playwright E2E Với Plyr Thật Trên Trình Duyệt Chromium
```text
> npx playwright test e2e/watch-keyboard.spec.ts

Running 1 test using 1 worker

  ok 1 [chromium] › e2e\watch-keyboard.spec.ts:65:5 › Desktop Keyboard Shortcuts with Real Plyr DOM: Space and Arrow keys work when settings closed, blocked when settings or modal open (3.1s)

  1 passed (11.7s)
```
- **Kịch bản A**: Plyr vừa khởi tạo, menu settings ẩn trong DOM $\rightarrow$ Phím Space toggle Play $\leftrightarrow$ Pause thành công, ArrowRight tua $+5$s (từ 50s lên 55s), ArrowLeft tua $-5$s (từ 55s về 50s).
- **Kịch bản B**: Mở Plyr Settings thật (`button[data-plyr='settings']` click $\rightarrow$ `aria-expanded="true"`) $\rightarrow$ Phím Space **KHÔNG** làm toggle video.
- **Kịch bản C**: Đóng Settings menu (bằng phím Escape $\rightarrow$ `aria-expanded="false"`) $\rightarrow$ Phím Space hoạt động lại bình thường.
- **Kịch bản D**: Mở Modal Báo lỗi phim $\rightarrow$ Phím Space **KHÔNG** làm toggle video.

### 4.2. Unit Test Runner (`npm run test:watch`)
```text
> frontend@0.1.0 test:watch
> node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test src/utils/episodeUtils.test.ts src/utils/watchPlaybackFlow.test.ts src/utils/watchTogetherFlow.test.ts

✔ normalizes common PhimAPI and OPhim episode labels (1.08ms)
✔ matches an OPhim episode when the active episode came from PhimAPI (0.17ms)
✔ matches a PhimAPI episode when the active episode came from OPhim (0.08ms)
✔ uses a valid fallback when providers genuinely have different episodes (0.08ms)
✔ restores the same episode and time after PhimAPI fails over to OPhim (0.76ms)
✔ prefetches only near the end and selects the normalized next episode (0.17ms)
✔ honors a temporary global CDN block but allows it again after expiry (0.15ms)
✔ uses the stable HLS release and bounds media recovery with an audio codec swap (0.49ms)
✔ Desktop Keyboard Shortcuts (Production Code): accurately distinguishes between open overlays and hidden Plyr/DOM menus with ancestor hierarchy (0.42ms)
✔ Mobile Gesture & Auto-Hide Lifecycle: background single-tap toggles controls, cancels pending tap on control click, holds on scrubber (0.22ms)
✔ Messenger-style Chat Matrix A/B/C: aligns messages strictly by viewer identity, not room role (1.16ms)
✔ two users with identical display names ('Sad nhân') are never confused (0.11ms)
✔ Unified Identity Lifecycle: assert ID_render === ID_join === msg.senderId under storage errors and reconnect (0.18ms)
✔ handles storage failure or missing IDs gracefully without crashing (0.10ms)
✔ system messages are never marked as self messages (0.09ms)
✔ groups continuous messages from the same sender within 60 seconds (0.13ms)
✔ resolves correct fullscreen action across desktop container vs iOS Safari native video (0.08ms)
✔ isNearBottom: detects whether chat scroll is within bottom threshold (0.08ms)
✔ shouldAutoScrollChat: preserves reader position when reading old messages, ignores user object re-renders without new messages (0.09ms)
✔ evaluateBatchAutoScroll MessageId & Session Lifecycle: MessageId matching, out-of-order ACK/Echo, session cleanup, same-account different devices (0.41ms)
✔ formatVietnamChatTime: formats time strictly in Asia/Ho_Chi_Minh 24h format (HH:mm) and rejects unverified strings (11.51ms)
✔ Session Lifecycle Isolation: Session teardown resets isSendingMessage and prevents stale callbacks from modifying new session (0.19ms)
✔ Episode Selection Button Lookup: uses stable data-episode-index to guarantee 100% accurate button identification regardless of name formatting (0.28ms)
ℹ tests 23 | suites 0 | pass 23 | fail 0 | cancelled 0 | skipped 0 | todo 0 | duration_ms 131.46ms
```
**Kết quả**: **23/23 tests PASSED (100%)**.

### 4.3. TypeScript Typecheck (`npx tsc --noEmit`)
- **Kết quả**: 0 lỗi TypeScript (Exit code 0).

### 4.4. Next.js Production Build (`npm run build`)
- **Kết quả**: 21/21 routes biên dịch thành công (Exit code 0).
- `/watch/[slug]`: Size 23.1 kB, First Load JS 148 kB.

### 4.5. Whitespace & Git Status (`git diff --check`)
- **Kết quả**: 0 lỗi format.

---

## 5. Trạng Thái Git Hiện Tại
```text
 M frontend/src/app/watch/[slug]/MobileWatchPlayerControls.tsx
 M frontend/src/app/watch/[slug]/page.tsx
 M frontend/src/utils/watchPlaybackFlow.test.ts
 M frontend/src/utils/watchPlaybackFlow.ts
?? frontend/e2e/watch-keyboard.spec.ts
```
*(Dừng lại để Codex review; KHÔNG commit, push hoặc deploy).*
