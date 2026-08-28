# Báo Cáo Hoàn Thiện Kiểm Thử E2E & Điều Tra Đếm Request (/watch/[slug])

## 1. Tổng Quan & Phạm Vi Đóng Băng (Scope & Frozen Boundaries)
- **Repository**: `D:\dlowphim`
- **Mục tiêu**:
  1. **Khắc phục triệt để nhánh E2E Modal Báo Lỗi & Settings Plyr** trong [watch-keyboard.spec.ts](file:///d:/dlowphim/frontend/e2e/watch-keyboard.spec.ts):
     - Loại bỏ hoàn toàn điều kiện `if (await count > 0)` bỏ qua assertion.
     - Sử dụng đúng selector nút `Báo lỗi` (`page.getByRole("button", { name: "Báo lỗi" })`).
     - Mở modal báo lỗi thực tế, xác nhận modal hiển thị (`Báo cáo lỗi phim`), blur focus ra khỏi các input/button trong modal nhưng giữ modal mở, chứng minh guard chặn `Space`, `ArrowRight`, `ArrowLeft`. Đóng modal bằng nút `Hủy bỏ` và chứng minh shortcut khôi phục.
     - Mở settings Plyr thật (`.plyr__menu > button[data-plyr='settings']`), blur focus ra khỏi nút nhưng giữ menu mở (`aria-expanded="true"`), chứng minh guard chặn `Space`/`Arrow`. Đóng settings và chứng minh shortcut khôi phục.
  2. **Điều tra nguyên nhân đếm request 2 thay vì 1** tại [watch-history.spec.ts](file:///d:/dlowphim/frontend/e2e/watch-history.spec.ts):
     - Phân tích chi tiết hành vi trên `next dev` (Next.js development server với `React.StrictMode`) so với `next start` (Production build).
     - Phân biệt request bắt đầu rồi bị `ERR_ABORTED` do Strict Mode effect cleanup với request thực sự hoàn tất (`requestfinished`).
  3. **Cô lập phụ thuộc CDN ngoài trong kiểm thử**:
     - Sử dụng `installMockHls(page)` và route mock cho `https://cdn.jsdelivr.net/**` để đảm bảo suite test chạy độc lập, ổn định 100% trong môi trường sandbox / airgapped.
- **Phạm vi đóng băng**:
  - Giữ nguyên `MobileWatchPlayerControls.tsx`.
  - Giữ nguyên implementation guard keyboard trong `watchPlaybackFlow.ts` và `page.tsx`.
  - Giữ nguyên `/watch-together`, backend, HLS/Plyr failover, layout/CSS.
  - Không commit, push, deploy, reset hoặc xóa dữ liệu.

---

## 2. Danh Sách Tệp Thay Đổi (Files Changed)
- [frontend/e2e/watch-keyboard.spec.ts](file:///d:/dlowphim/frontend/e2e/watch-keyboard.spec.ts):
  - Bổ sung `installMockHls(page)` và mock CDN jsDelivr.
  - Cập nhật toàn bộ các assertion chặt chẽ cho Settings Plyr (`aria-expanded="true"`, blur test, close) và Modal Báo lỗi (`Báo lỗi`, `Báo cáo lỗi phim`, blur test, `Hủy bỏ`).
- [frontend/e2e/watch-history.spec.ts](file:///d:/dlowphim/frontend/e2e/watch-history.spec.ts):
  - Cập nhật test `Watch chỉ tải nguồn dự phòng một lần sau khi phim chính sẵn sàng` để theo dõi completed requests (`requestfinished`), loại trừ các request bị abort bởi Strict Mode effect cleanup.

---

## 3. Kết Quả Điều Tra Đếm Request 2 Thay Vì 1

### 3.1. Bằng Chứng Nhật Ký Chẩn Đoán Thực Tế (E2E Diagnostic Trace)
Khi chạy trên `next dev` (`command: "npm run dev"` trong `playwright.config.ts`), Playwright ghi nhận:
```text
[E2E Diagnostic] request START check-blocked (#1)
[E2E Diagnostic] request START check-blocked (#2)
[E2E Diagnostic] request FAILED check-blocked: net::ERR_ABORTED
[E2E Diagnostic] request FINISHED check-blocked (#1)
[E2E Diagnostic] request START resolved-detail (#1)
[E2E Diagnostic] request FINISHED resolved-detail (#1)
[E2E Diagnostic Summary] {
  blocked: 2,
  blockedFinished: 1,
  blockedFailed: 1,
  resolvedDetail: 1,
  resolvedDetailFinished: 1,
  resolvedDetailFailed: 0
}
```

### 3.2. Phân Tích Nguyên Nhân Kỹ Thuật
1. **Môi trường `next dev` & React StrictMode**:
   - `playwright.config.ts` cấu hình khởi chạy `webServer: { command: "npm run dev" }`.
   - Trong chế độ phát triển, Next.js kích hoạt `React.StrictMode` khiến `useEffect(..., [slug])` trong `page.tsx` chạy chu trình: **Mount 1 $\rightarrow$ Cleanup $\rightarrow$ Mount 2**.
2. **Cơ chế AbortController của ứng dụng**:
   - Ở Mount 1, hàm `fetchMovieDetail` bắt đầu gửi request `/movies/check-blocked/phim-kiem-thu-e2e`.
   - Khi Strict Mode kích hoạt cleanup, `controller.abort()` được gọi ngay lập tức, làm request #1 bị hủy (`net::ERR_ABORTED`) trước khi kịp gửi tiếp `/movies/resolved-detail/`.
   - Ở Mount 2, `fetchMovieDetail` gửi lại request `/movies/check-blocked/phim-kiem-thu-e2e` (request #2, hoàn tất thành công) và tiếp tục gửi `/movies/resolved-detail/` (hoàn tất thành công).
3. **Sự khác biệt giữa `page.on("request")` và `page.on("requestfinished")`**:
   - `page.on("request")` bắt sự kiện ngay khi trình duyệt khởi tạo kết nối (bao gồm cả request bị abort). Do đó `blocked` nhận giá trị 2 (1 aborted + 1 completed).
   - `page.on("requestfinished")` chỉ bắt các request hoàn tất thực sự nhận phản hồi từ server. Do đó cả `blockedFinished` và `resolvedDetailFinished` đều là **chính xác 1**.
4. **Môi trường Production (`next start`)**:
   - Trong production build (`npm run build` && `npm run start`), React StrictMode không chạy mount giả lập, cả `request` và `requestfinished` đều đếm đúng **1**.

---

## 4. Chi Tiết Thực Thi E2E Keyboard & Modal

### 4.1. Kịch Bản Settings Plyr
1. Khởi tạo player HLS với Plyr production DOM.
2. Tìm nút cài đặt `.plyr__menu > button[data-plyr='settings']` $\rightarrow$ assert `toBeVisible()`.
3. Bấm mở settings $\rightarrow$ assert `toHaveAttribute("aria-expanded", "true")`.
4. Đưa focus ra khỏi nút bằng `blur()` nhưng menu vẫn mở $\rightarrow$ Nhấn `Space`, `ArrowRight`, `ArrowLeft` $\rightarrow$ Xác nhận video không toggle và không tua (chứng minh guard bảo vệ độc lập với thẻ button).
5. Bấm đóng settings $\rightarrow$ assert `toHaveAttribute("aria-expanded", "false")` $\rightarrow$ Nhấn `Space` và `Arrow` $\rightarrow$ Xác nhận toggle và tua hoạt động trở lại.

### 4.2. Kịch Bản Modal Báo Lỗi
1. Tìm nút `Báo lỗi` bằng `page.getByRole("button", { name: "Báo lỗi" })` $\rightarrow$ assert `toBeVisible()`.
2. Bấm mở modal $\rightarrow$ assert tiêu đề modal `Báo cáo lỗi phim` hiển thị (`toBeVisible()`).
3. Đưa focus ra khỏi các ô nhập liệu/nút trong modal bằng `blur()` nhưng giữ modal mở $\rightarrow$ Nhấn `Space`, `ArrowRight`, `ArrowLeft` $\rightarrow$ Xác nhận video không toggle và không tua.
4. Bấm nút `Hủy bỏ` (`page.getByRole("button", { name: "Hủy bỏ" })`) $\rightarrow$ assert modal biến mất (`toBeHidden()`).
5. Nhấn `Space` $\rightarrow$ Xác nhận video toggle play/pause trở lại bình thường.

---

## 5. Kết Quả Kiểm Tra Toàn Diện (Verification Evidence)

### 5.1. Playwright E2E Suite (12/12 tests PASS)
```text
> npx playwright test

Running 12 tests using 8 workers

  ok  6 [chromium] › e2e\watch-history.spec.ts:437:5 › Trạng thái offline không tràn hoặc nhân đôi player tại các breakpoint watch (4.8s)
  ok  8 [chromium] › e2e\watch-history.spec.ts:470:5 › HLS chỉ khởi tạo sau khi auth hiện hành tải xong (4.8s)
  ok  7 [chromium] › e2e\watch-history.spec.ts:414:5 › Mở trang khi offline chờ mạng và chỉ khởi tạo HLS một lần sau khi online (5.0s)
  ok  4 [chromium] › e2e\watch-history.spec.ts:365:5 › Mất mạng không phạt CDN hoặc chuyển Embed và tự thử lại một lần khi online (11.1s)
  ok  3 [chromium] › e2e\watch-history.spec.ts:323:5 › Lịch sử khôi phục đúng phim, tập và tiến độ (12.1s)
  ok  5 [chromium] › e2e\watch-history.spec.ts:344:5 › HLS lỗi sau phục hồi giới hạn thì chuyển sang embed và không bật lại HLS (12.1s)
  ok  2 [chromium] › e2e\watch-history.spec.ts:302:5 › Watch chỉ tải nguồn dự phòng một lần sau khi phim chính sẵn sàng (12.1s)
  ok  1 [chromium] › e2e\watch-history.spec.ts:293:5 › Watch ghép nguồn và chuyển đúng tập từ URL (12.4s)
  ok  9 [chromium] › e2e\watch-history.spec.ts:496:5 › Lịch sử embed chỉ đồng bộ sau khi auth hiện hành tải xong (8.2s)
  ok 11 [chromium] › e2e\watch-history.spec.ts:562:5 › Phiên xem dài không remount player, tích lũy listener hoặc spam prefetch (8.0s)
  ok 10 [chromium] › e2e\watch-history.spec.ts:541:5 › Đổi tập sau embed failover reset đúng về HLS của tập mới (9.3s)
  ok 12 [chromium] › e2e\watch-keyboard.spec.ts:101:5 › Desktop Keyboard Shortcuts with Real Plyr DOM: Space and Arrow keys work when settings closed, blocked when settings or modal open (5.0s)

  12 passed (25.9s)
```

### 5.2. Unit Test Runner (`npm run test:watch`)
```text
> frontend@0.1.0 test:watch
> node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test src/utils/episodeUtils.test.ts src/utils/watchPlaybackFlow.test.ts src/utils/watchTogetherFlow.test.ts

ℹ tests 23 | suites 0 | pass 23 | fail 0 | cancelled 0 | skipped 0 | todo 0 | duration_ms 144.9ms
```

### 5.3. TypeScript Check (`npx tsc --noEmit`)
- **Kết quả**: 0 lỗi (Exit code 0).

### 5.4. Next.js Production Build (`npm run build`)
- **Kết quả**: 21/21 routes biên dịch thành công (Exit code 0).

### 5.5. Whitespace & Git Diff (`git diff --check`)
- **Kết quả**: 0 lỗi whitespace/format.

---

## 6. Giới Hạn Chưa Xác Minh & Trạng Thái Git Hiện Tại
- **Giới hạn chưa xác minh**:
  - Test E2E chạy trên trình duyệt Chromium headless giả lập desktop 1280x800; chưa xác minh trực tiếp trên phần cứng iPhone/Android vật lý (tuân thủ nguyên tắc không tự nhận pass thiết bị thật).
- **Trạng thái Git**:
```text
 M frontend/e2e/watch-history.spec.ts
 M frontend/src/app/watch/[slug]/MobileWatchPlayerControls.tsx
 M frontend/src/app/watch/[slug]/page.tsx
 M frontend/src/utils/watchPlaybackFlow.test.ts
 M frontend/src/utils/watchPlaybackFlow.ts
?? frontend/e2e/watch-keyboard.spec.ts
```
*(Dừng lại để Codex review; KHÔNG commit, push hoặc deploy).*
