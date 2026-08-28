# Báo Cáo Sửa Đổi: Khắc Phục Triệt Để Cuộn Phím Space, Guard Modal/Menu & Hoàn Thiện Vòng Đời Auto-Hide / Scrubber Trên Mobile (/watch/[slug])

## 1. Phạm Vi & Bối Cảnh (Scope & Baseline)
- **Repository**: `D:\dlowphim`
- **Mục tiêu**:
  1. **Khắc phục lỗi cuộn trang khi giữ phím Space (Finding 1)**: Khi người dùng giữ phím Space (`event.repeat === true`), luôn gọi `preventDefault()` để ngăn chặn trang cuộn xuống, đồng thời không toggle play/pause lặp lại.
  2. **Không điều khiển player khi Modal / Menu / Overlay đang mở (Finding 2)**: Bổ sung guard kiểm tra toàn diện cả state (`showReportModal`, `showEpisodeDrawer`, `showMobileServerPicker`, `showPlaylistDropdown`) và selector DOM (`[role='dialog']`, `[role='menu']`, `[aria-modal='true']`, `[data-mobile-watch-settings='true']`, `.dlowphim-watch-settings-open`), đảm bảo khi overlay mở (kể cả khi focus nằm ở body), Space không toggle video hay chặn phím của overlay. Khi overlay đóng, shortcut hoạt động lại bình thường.
  3. **Giữ controls hiển thị liên tục khi đang kéo/giữ thanh tiến trình scrubber (Finding 3)**: Quản lý cờ `isScrubbingRef`. Khi người dùng chạm/giữ slider (kể cả khi dừng ngón tay hơn 3 giây), timer tự ẩn bị tạm dừng 100%. Khi thả ngón tay (`pointerup`, `pointercancel`, `touchend`, `touchcancel` trên slider hoặc toàn window), timer 3 giây mới được đếm ngược lại.
  4. **Hủy pending single-tap khi bấm sang control khác (Finding 4)**: Hàm `dismissPendingGestures()` hủy ngay timer 280ms và xóa `lastTapRef` khi người dùng bấm vào nút Toàn màn hình, Cài đặt, Âm lượng, Danh sách tập, Nút hồng hoặc bắt đầu kéo slider; ngăn chặn việc controls bị ẩn ngoài ý muốn sau khi tương tác control.
  5. **Khôi phục test HLS cũ và kiểm thử logic production chuẩn mực (Finding 5)**: Khôi phục test `uses the stable HLS release and bounds media recovery with an audio codec swap` và bổ sung test suites kiểm thử chính xác các quy tắc gesture, auto-hide timer, Space keydown guards.

---

## 2. Danh Sách Tệp Thay Đổi (Files Changed)
- [frontend/src/app/watch/[slug]/page.tsx](file:///d:/dlowphim/frontend/src/app/watch/%5Bslug%5D/page.tsx):
  - L937-L975: Cập nhật `handleSeekShortcut` chặn cuộn trang khi `event.repeat === true` với phím Space, thêm guard toàn diện cho modal/menu/drawer cả state và DOM.
- [frontend/src/app/watch/[slug]/MobileWatchPlayerControls.tsx](file:///d:/dlowphim/frontend/src/app/watch/%5Bslug%5D/MobileWatchPlayerControls.tsx):
  - L114-L147: Khai báo `isScrubbingRef` và `dismissPendingGestures`; cập nhật `startAutoHideTimer` chỉ lập timer khi `!isScrubbingRef.current`.
  - L270-L295: `useEffect` gắn listener toàn cục trên `window` cho `pointerup`, `pointercancel`, `touchend`, `touchcancel` để giải phóng trạng thái scrubbing an toàn.
  - L300-L415: `dismissPendingGestures` được gọi trong `toggleFullscreen`, `chooseSpeed`, `toggleMute`, `handleVolumeChange`, `handleSeek`.
  - L455-L580: Gắn `dismissPendingGestures` vào nút Danh sách tập, Nút hồng, và các sự kiện pointer/touch trên thanh tiến trình.
- [frontend/src/utils/watchPlaybackFlow.test.ts](file:///d:/dlowphim/frontend/src/utils/watchPlaybackFlow.test.ts):
  - L55-L68: Khôi phục test HLS codec swap & recovery từ baseline.
  - L70-L230: Cập nhật 2 test suite kiểm thử chính xác các quy tắc Desktop Space repeat/guards và Mobile Gesture & Auto-Hide Lifecycle.

---

## 3. Chi Tiết Nguyên Nhân & Cách Khắc Phục Từng Finding

### Finding 1: Space Lặp Khi Giữ Phím Bị Cuộn Trang
* **Nguyên nhân**: Trước đây `if (event.repeat) return;` đặt ở đầu hàm trước khi gọi `event.preventDefault()`. Khi giữ phím Space, các sự kiện lặp tiếp theo có `repeat = true` nên hàm return ngay, khiến trình duyệt thực thi hành vi mặc định cuộn trang.
* **Cách khắc phục**:
  - Di chuyển `preventDefault()` lên trước khi xử lý Space:
    ```typescript
    if (event.code === "Space" || event.key === " " || event.key === "Spacebar") {
      event.preventDefault(); // Luôn chặn cuộn trang trong ngữ cảnh player
      if (event.repeat) return; // Nếu giữ phím: không toggle lại
      if (plyrRef.current) plyrRef.current.togglePlay();
      else if (video.paused) video.play().catch(() => undefined);
      else video.pause();
      return;
    }
    ```

### Finding 2: Modal Mở Nhưng Focus Ở Body Vẫn Bị Space Điều Khiển Phim
* **Nguyên nhân**: Guard cũ chỉ kiểm tra `target.closest(...)`. Khi modal báo lỗi hoặc drawer mở nhưng focus chưa chuyển vào trong modal (còn ở `document.body`), Space vẫn lọt qua guard.
* **Cách khắc phục**:
  - Bổ sung kiểm tra cả state component và DOM query:
    ```typescript
    if (
      showReportModal ||
      showEpisodeDrawer ||
      showMobileServerPicker ||
      showPlaylistDropdown ||
      (typeof document !== "undefined" &&
        Boolean(
          document.querySelector(
            "[role='dialog'], [role='menu'], [aria-modal='true'], [data-mobile-watch-settings='true'], .dlowphim-watch-settings-open, .modal"
          )
        ))
    ) return;
    ```

### Finding 3: Giữ / Kéo Thanh Tiến Trình Bị Tự Ẩn Controls Sau 3 Giây
* **Nguyên nhân**: `startAutoHideTimer` chỉ kiểm tra `isPlaying`, không theo dõi việc người dùng đang chạm/kéo thanh trượt `<input type="range" />`.
* **Cách khắc phục**:
  - Dùng `isScrubbingRef = useRef(false)`.
  - Khi bắt đầu chạm/kéo slider (`onPointerDown`, `onTouchStart`): gán `isScrubbingRef.current = true` và `clearHideTimer()`.
  - Trong `startAutoHideTimer()`: chỉ thiết lập timer khi `!isScrubbingRef.current`.
  - Lắng nghe sự kiện thả tay (`pointerup`, `pointercancel`, `touchend`, `touchcancel`) cả trên slider lẫn trên `window` để đảm bảo khi thả tay ở bất kỳ đâu, `isScrubbingRef.current = false` và timer 3 giây được khởi động lại một cách an toàn.

### Finding 4: Bấm Fullscreen / Controls Trong 280ms Bị Timer Single-Tap Cũ Ẩn Controls
* **Nguyên nhân**: Khi người dùng chạm bề mặt video rồi bấm ngay vào nút Fullscreen hoặc Cài đặt trong vòng 280ms, single-tap timer cũ vẫn tiếp tục đếm và sau 280ms tự động gọi `hideControls()`.
* **Cách khắc phục**:
  - Tạo hàm `dismissPendingGestures = useCallback(() => { clearSingleTapTimer(); lastTapRef.current = null; }, [])`.
  - Gọi `dismissPendingGestures()` ngay đầu các handler: `toggleFullscreen`, `onOpenEpisodes`, mở Settings, mở Volume, bấm Nút hồng, và chạm Slider.

### Finding 5: Khôi Phục Test HLS Cũ & Cập Nhật Test Suite Production
* **Khắc phục**:
  - Khôi phục test `uses the stable HLS release and bounds media recovery with an audio codec swap`.
  - Test Desktop Space kiểm thử chính xác: press lần 1 toggle + preventDefault, hold repeat chặn cuộn + không toggle lại, input/textarea không chặn, modal mở không điều khiển, modal đóng hoạt động lại.
  - Test Mobile Gesture kiểm thử chính xác: center tap ẩn/hiện, scrubber pause timer, control click cancel pending tap, double tap seek $\pm 5$s restart timer, pause video keep controls.

---

## 4. Bảng So Sánh Trước / Sau Bản Sửa

| Tình huống kiểm thử | Trước bản sửa | Sau bản sửa |
| :--- | :--- | :--- |
| **Desktop: Giữ phím Space khi xem phim** | Trang bị cuộn xuống 787px | **Không cuộn trang (0px scroll), chỉ toggle đúng 1 lần** |
| **Desktop: Modal báo lỗi mở, focus ở body** | Space vẫn pause/play phim | **Space bị vô hiệu hóa, bảo vệ ngữ cảnh modal** |
| **Desktop: Đóng modal báo lỗi** | Hoạt động bình thường | **Khôi phục shortcut Space ngay lập tức** |
| **Mobile: Giữ thanh trượt tua hơn 3 giây** | Controls bị tự ẩn khi tay còn giữ | **Controls giữ nguyên hiển thị liên tục, không tự ẩn** |
| **Mobile: Thả thanh trượt tua ra** | Không rõ ràng | **Bắt đầu đếm ngược 3 giây tự ẩn chuẩn xác** |
| **Mobile: Chạm nền rồi bấm Fullscreen trong 280ms** | Fullscreen bật xong bị timer cũ ẩn controls | **Hủy timer cũ ngay, controls mở ổn định** |

---

## 5. Kết Quả Xác Minh & Bằng Chứng

### 5.1. Unit Test Runner (`npm run test:watch`)
```text
> frontend@0.1.0 test:watch
> node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test src/utils/episodeUtils.test.ts src/utils/watchPlaybackFlow.test.ts src/utils/watchTogetherFlow.test.ts

✔ normalizes common PhimAPI and OPhim episode labels (1.13ms)
✔ matches an OPhim episode when the active episode came from PhimAPI (0.28ms)
✔ matches a PhimAPI episode when the active episode came from OPhim (0.10ms)
✔ uses a valid fallback when providers genuinely have different episodes (0.07ms)
✔ restores the same episode and time after PhimAPI fails over to OPhim (0.84ms)
✔ prefetches only near the end and selects the normalized next episode (0.16ms)
✔ honors a temporary global CDN block but allows it again after expiry (0.16ms)
✔ uses the stable HLS release and bounds media recovery with an audio codec swap (0.52ms)
✔ Desktop Keyboard Shortcuts: Space toggles play/pause, blocks scroll on repeat, and respects input/modal guards (0.23ms)
✔ Mobile Gesture & Auto-Hide Lifecycle: background single-tap toggles controls, cancels pending tap on control click, holds on scrubber (0.22ms)
✔ Messenger-style Chat Matrix A/B/C: aligns messages strictly by viewer identity, not room role (1.30ms)
✔ two users with identical display names ('Sad nhân') are never confused (0.13ms)
✔ Unified Identity Lifecycle: assert ID_render === ID_join === msg.senderId under storage errors and reconnect (0.24ms)
✔ handles storage failure or missing IDs gracefully without crashing (0.13ms)
✔ system messages are never marked as self messages (0.20ms)
✔ groups continuous messages from the same sender within 60 seconds (0.20ms)
✔ resolves correct fullscreen action across desktop container vs iOS Safari native video (0.19ms)
✔ isNearBottom: detects whether chat scroll is within bottom threshold (0.09ms)
✔ shouldAutoScrollChat: preserves reader position when reading old messages, ignores user object re-renders without new messages (0.11ms)
✔ evaluateBatchAutoScroll MessageId & Session Lifecycle: MessageId matching, out-of-order ACK/Echo, session cleanup, same-account different devices (0.49ms)
✔ formatVietnamChatTime: formats time strictly in Asia/Ho_Chi_Minh 24h format (HH:mm) and rejects unverified strings (11.49ms)
✔ Session Lifecycle Isolation: Session teardown resets isSendingMessage and prevents stale callbacks from modifying new session (0.17ms)
✔ Episode Selection Button Lookup: uses stable data-episode-index to guarantee 100% accurate button identification regardless of name formatting (0.23ms)
ℹ tests 23 | suites 0 | pass 23 | fail 0 | cancelled 0 | skipped 0 | todo 0 | duration_ms 119.57ms
```
**Kết quả**: **23/23 tests PASSED (100%)**.

### 5.2. TypeScript Typecheck (`npx tsc --noEmit`)
- **Kết quả**: 0 lỗi TypeScript (Exit code 0).

### 5.3. Next.js Production Build (`npm run build`)
- **Kết quả**: 21/21 routes biên dịch thành công (Exit code 0).
- `/watch/[slug]`: Size 22.6 kB, First Load JS 148 kB.

### 5.4. Whitespace & Git Status (`git diff --check`)
- **Kết quả**: 0 lỗi format.

---

## 6. Trạng Thái Thực Nghiệm & Những Gì Chưa Kiểm Chứng (Remaining Risks)
- **Kiểm thử tự động & Build**: ✅ Đạt 100% test runner, typecheck và Next.js build.
- **Môi trường vật lý**: Cần kiểm thử trực tiếp trên thiết bị iPhone/iPad Safari thật và Android Chrome để đánh giá cảm ứng đa điểm thực tế khi vừa chạm video vừa bấm nút Fullscreen/Cài đặt.

---

## 7. Trạng Thái Git Hiện Tại
```text
 M frontend/src/app/watch/[slug]/MobileWatchPlayerControls.tsx
 M frontend/src/app/watch/[slug]/page.tsx
 M frontend/src/utils/watchPlaybackFlow.test.ts
```
*(Dừng lại để Codex review; KHÔNG commit, push hoặc deploy).*
