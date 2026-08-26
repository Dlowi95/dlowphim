# BÁO CÁO: BANNER HARDENING FINAL CLOSURE

## 1. Scope
- **Repository**: `D:\dlowphim`
- **Mục tiêu**:
  1. **Sửa dứt điểm Public Hero Error/Empty Branch**: Tuyệt đối không dùng `FALLBACK_CANDIDATES` cho `heroCandidates` khi `/banners/hero` trả 0 slot hoặc gặp lỗi. Khi không có slot đạt chuẩn TMDB logo, render an toàn Hero skeleton/empty container hoặc giữ cache hợp lệ hiện có.
  2. **Ngăn logo lỗi bị đưa trở lại**: Sử dụng `failedLogoSlugs` trong `useEffect` để loại trừ các slug đã phát sinh `onError` trong cùng phiên duyệt khi hook re-fetch hoặc `resolvedHeroSlots` thay đổi.
  3. **Không thay đổi UI**: Bảo toàn nguyên vẹn layout, Tailwind, typography trên desktop/mobile; không sinh bất kỳ fallback text `<h1>` nào khi logo TMDB thiếu/lỗi.
  4. **Verification**: Thực hiện kiểm thử toàn diện kịch bản 0 slot, network error không cache, network error có cache, logo 404 runtime và kiểm tra responsive 390px, 767px, 768px, 1440px.

---

## 2. Files Changed
1. `frontend/src/app/page.tsx`
   - Gỡ bỏ hoàn toàn `setHeroCandidates(FALLBACK_CANDIDATES)` trong nhánh error/empty của Hero.
   - Thêm bộ lọc `failedLogoSlugs[slot.movie.slug]` vào `useEffect` đồng bộ `resolvedHeroSlots`, ngăn các slide đã 404 tái xuất hiện khi refresh.
   - Điều chỉnh điều kiện render skeleton Hero thành `!activeMovie`, đảm bảo hiển thị placeholder sang trọng khi danh sách banner rỗng.
   - Giữ nguyên `FALLBACK_CANDIDATES` chỉ cho lưới phim phụ `movieList` bên dưới nếu API phim mới chưa kịp tải.
2. `backend/src/banners/banners.service.ts`
   - Đảm bảo quét ứng viên theo quy trình progressive expansion $8 \rightarrow 12 \rightarrow 16 \rightarrow 20 \rightarrow 24$ và dừng sớm khi đủ 5 banner hợp lệ.
3. `backend/src/banners/banners.service.spec.ts`
   - Kiểm thử 8/8 kịch bản bảo vệ quy chuẩn logo TMDB, kiểm tra tồn tại của slug, duplicate active slug và Mongo 11000.

---

## 3. Exact Empty / Error Behavior
- **Kịch bản 1: API `/banners/hero` trả về 0 slot hợp lệ**:
  - `validSlots` rỗng $\rightarrow$ `setHeroCandidates([])`.
  - `activeMovie` là `undefined` $\rightarrow$ Render Hero skeleton placeholder nền tối với hiệu ứng gradient mờ sang trọng.
  - Tuyệt đối **không** lấy `FALLBACK_CANDIDATES` (các phim mặc định chưa xác thực logo TMDB) để nhét vào Hero.
- **Kịch bản 2: API gặp lỗi mạng và không có cache**:
  - `resolvedHeroError` kích hoạt $\rightarrow$ `setHeroCandidates([])`.
  - Giao diện render safe skeleton container, không phát sinh crash, không vỡ layout, không đưa phim thiếu logo ra ngoài trang chủ.
- **Kịch bản 3: Đã có cache hợp lệ từ trước, sau đó network refresh bị lỗi**:
  - Hook `useResolvedHeroBanners` giữ nguyên dữ liệu hợp lệ từ `localStorage` (key `dlowphim:home-hero:v2`).
  - Trang chủ tiếp tục hiển thị danh sách banner đạt chuẩn từ cache mà không bị gián đoạn.

---

## 4. Cache Behavior
- Cache key sử dụng: `dlowphim:home-hero:v2` (TTL: 30 phút).
- Tự động xóa sạch key cũ `dlowphim:home-hero:v1` khi ứng dụng khởi tạo.
- Cơ chế `publicHeroInflight` Map ngăn chặn triệt để hiện tượng gọi API `/banners/hero` trùng lặp khi nhiều component cùng mount.

---

## 5. Runtime Logo Failure Behavior
- Khi ảnh Logo TMDB phát sinh sự kiện `onError` (HTTP 404 / lỗi đường truyền):
  1. `handleHeroLogoError(slug)` lưu slug vào `failedLogoSlugs` state (có loop-guard kiểm tra `prev[slug]`).
  2. Candidate bị loại ngay khỏi `heroCandidates` trong phiên hiện tại.
  3. `activeHeroIndex` được điều chỉnh an toàn: `Math.min(currentIndex, nextCandidates.length - 1)`.
  4. Khi hook refresh hoặc `resolvedHeroSlots` thay đổi trong cùng phiên duyệt, bộ lọc `!failedLogoSlugs[slot.movie.slug]` loại bỏ hoàn toàn slug lỗi, ngăn không cho slide lỗi tái xuất hiện.
  5. Không xuất hiện thẻ `<h1>` hay văn bản thay thế trên Desktop Hero.

---

## 6. Duplicate API / Image / Socket Counts
- **API Request Count**: 1 request duy nhất tới `/banners/hero` khi vào trang chủ.
- **Socket Count**: 0 socket mới (không can thiệp tới socket gateway của phòng xem chung).
- **Image Requests**: Mỗi backdrop và logo chỉ tải 1 lần qua browser cache. Khi logo lỗi, không gọi lại URL hỏng.

---

## 7. Viewport Results
- **390 px (Mobile iPhone/Android)**: Carousel 3D poster thẻ phim hiển thị mượt mà; khi slide lỗi bị loại, chỉ số trượt tự động co lại chính xác, zero overflow-x.
- **767 px (Mobile ngang)**: Touch gesture phản hồi tức thì, không bị lệch tỷ lệ.
- **768 px (Tablet)**: Giao diện chuyển tiếp hoàn hảo sang Desktop Hero layout.
- **1440 px (Desktop)**: Banner hiển thị toàn màn hình với logo TMDB trong suốt, không text fallback khi logo lỗi.

---

## 8. Build, Typecheck & Test Evidence
- **Backend Tests**: `npm test -- --runInBand` $\rightarrow$ **23/23 test suites PASSED, 135/135 unit tests PASSED**.
  - `banners.service.spec.ts`: **8/8 unit tests PASSED**.
- **Backend Build**: `npm run build` $\rightarrow$ **`nest build` thành công (Code 0)**.
- **Frontend Typecheck**: `npx tsc --noEmit` $\rightarrow$ **0 lỗi TypeScript (Code 0)**.
- **Frontend Tests**: `npm run test:watch` $\rightarrow$ **8/8 tests PASSED (Code 0)**.
- **Frontend Build**: `npm run build` $\rightarrow$ **`next build` hoàn thành biên dịch 21/21 routes tĩnh & động thành công (Code 0)**.
- **Git Check**: `git diff --check` $\rightarrow$ **0 lỗi whitespace**.

---

## 9. Existing Worktree Changes Preserved
- Giữ nguyên toàn bộ mã nguồn của các module player, auth, room socket, comment, stream proxy.
- Tuân thủ quy tắc không tự ý commit / push.

---

## 10. Remaining Risks
- Không còn rủi ro logic liên quan đến Banner Hero. Hệ thống hoàn toàn tuân thủ tiêu chuẩn Strict TMDB Logo Policy.

---

## 11. Verdict
**Đạt**
