# BÁO CÁO: BANNER HARDENING CORRECTION

## 1. Scope
- **Repository**: `D:\dlowphim`
- **Mục tiêu**: Hoàn thiện toàn diện các điểm hiệu chỉnh bắt buộc cho Banner Hardening:
  1. **Logo runtime fallback**: Tự động hiển thị tiêu đề phim dạng văn bản (`<h1>` có hiệu ứng đổ bóng chuẩn UI) khi logo TMDB có URL nhưng tải thất bại hoặc bị 404, có loop-guard chống render lặp.
  2. **Duplicate active slug**: Kiểm tra slug hiệu lực cuối cùng trong cả 3 tình huống (đổi `movieSlug` trên banner đang active, bật `isActive: false -> true` khi không gửi `movieSlug`, cập nhật đồng thời cả hai).
  3. **Slug validation**: Xác minh `movieSlug` thực sự tồn tại qua data source/proxy trước khi tạo hoặc cập nhật, phân biệt lỗi máy chủ nguồn với trường hợp slug không tồn tại.
  4. **Cache migration**: Nâng cấp cache key Hero sang `dlowphim:home-hero:v2` và dọn sạch key `v1` cũ trên mount.
  5. **Database integrity**: Bổ sung ràng buộc index duy nhất `unique: true` cho trường `order` (1–5) trên Mongoose schema và chuyển đổi lỗi Mongo `code: 11000` thành HTTP 409 `ConflictException`.
  6. **Responsive & Verification**: Đảm bảo an toàn trên mọi viewport 390px, 767px, 768px, 1440px mà không tạo request, ảnh hoặc socket trùng.

---

## 2. Files Changed
1. `backend/src/banners/schemas/banner.schema.ts`
   - Bổ sung `@Prop({ required: true, unique: true, min: 1, max: 5 }) order: number;`.
2. `backend/src/banners/banners.service.ts`
   - Thêm phương thức `verifyMovieSlugExists(movieSlug)` kiểm tra tính tồn tại của slug qua active/fallback data sources và custom movies.
   - Bổ sung logic tính toán `effectiveSlug` và `effectiveIsActive` trong `update()` để chặn duplicate active slug trong mọi tình huống.
   - Bọc `save()` và `findByIdAndUpdate()` trong `try/catch` bắt mã lỗi Mongo `11000` chuyển thành `ConflictException` (HTTP 409).
3. `backend/src/banners/banners.service.spec.ts`
   - Thêm unit test kiểm tra validate slug không tồn tại $\rightarrow$ `BadRequestException`.
   - Thêm unit test kiểm tra 3 kịch bản duplicate active slug $\rightarrow$ `ConflictException`.
   - Thêm unit test bắt lỗi cạnh tranh Mongo 11000 $\rightarrow$ `ConflictException`.
4. `frontend/src/hooks/useResolvedHeroBanners.ts`
   - Đổi cache key thành `dlowphim:home-hero:v2`.
   - Thêm lệnh dọn dẹp `localStorage.removeItem("dlowphim:home-hero:v1")` khi khởi tạo.
5. `frontend/src/app/page.tsx`
   - Bổ sung state `failedLogoSlugs` và hàm `handleHeroLogoError(slug)` có loop-guard.
   - Khi logo 404/lỗi tải, tự động chuyển sang render `<h1>` chữ nổi với typography gốc, không để khoảng trống vô nghĩa.
6. `frontend/src/components/admin/BannersManagementView.tsx`
   - Giữ nguyên giao diện 5 vị trí cố định, Movie Search Picker và quy chuẩn Logo TMDB an toàn.

---

## 3. Exact Fixes

### A. Logo Runtime Fallback
- **Vấn đề trước sửa**: Khi `logoUrl` bị lỗi mạng hoặc 404 từ CDN bên thứ 3, việc chỉ gán `display: none` cho `<img>` làm mất cả logo lẫn tiêu đề văn bản, để lại khoảng trống màu đen.
- **Giải pháp**:
  - Quản lý `failedLogoSlugs: Record<string, boolean>` trong React state.
  - Khi thẻ `<img>` bắn sự kiện `onError`, kích hoạt `handleHeroLogoError(activeMovie?.slug)` (có kiểm tra `prev[slug]` để tránh re-render vô tận).
  - Điều kiện hiển thị: `Boolean(logoUrl && !failedLogoSlugs[activeMovie?.slug])`. Khi `false`, component tự động fallback về thẻ `<h1>` tiêu đề gốc với typography và drop-shadow cao cấp.

### B. Duplicate Active Slug & Validation
- **Vấn đề trước sửa**: Nếu chỉ kiểm tra `payload.movieSlug` và `payload.isActive` khi cả hai cùng có trong request, thì việc chỉ gửi `{ isActive: true }` khi banner đang ở trạng thái draft (hoặc chỉ gửi `{ movieSlug: 'slug-da-co' }` trên banner đang active) sẽ lọt qua validation.
- **Giải pháp**:
  - `update()` luôn truy vấn `existingBanner = await this.bannerModel.findById(id)`.
  - Tính `effectiveSlug = payload.movieSlug !== undefined ? payload.movieSlug : existingBanner.movieSlug`.
  - Tính `effectiveIsActive = payload.isActive !== undefined ? payload.isActive : existingBanner.isActive`.
  - Nếu `effectiveIsActive === true`: Kiểm tra xem có banner nào khác (`_id: { $ne: id }`) đang có `movieSlug: effectiveSlug && isActive: true` hay không. Nếu có, ném ngay `ConflictException` (409).
  - Xác thực slug tồn tại: Gọi `verifyMovieSlugExists(movieSlug)` kiểm tra qua active provider, fallback provider và custom movies. Nếu không tìm thấy, ném `BadRequestException` (400).

### C. Database Integrity & Mongo 11000 Duplicate Key Error
- **Giải pháp**:
  - Schema đặt `unique: true` cho trường `order`.
  - Toàn bộ thao tác tạo/sửa banner được bọc try/catch kiểm tra `if (error?.code === 11000)`, trả về thông báo lỗi 409 rõ ràng: *"Vị trí N hoặc slug đã tồn tại trên hệ thống."*
  - Không chạy migration phá hủy dữ liệu.

### D. Cache Migration
- **Giải pháp**:
  - Thay đổi `PUBLIC_HERO_CACHE_KEY = "dlowphim:home-hero:v2"`.
  - Xóa khóa `dlowphim:home-hero:v1` khi frontend khởi tạo.

---

## 4. Backend Validation and DB Index Evidence
- Đã chạy 7/7 unit tests trong `banners.service.spec.ts`:
  1. `merges admin slots and strictly enforces TMDB logo requirement on auto candidates` $\rightarrow$ **PASS**
  2. `allows admin to manually pin anime with valid TMDB logo and backdrop` $\rightarrow$ **PASS**
  3. `progressively expands TMDB candidates until all five automatic slots with logos are filled` $\rightarrow$ **PASS**
  4. `validates movieSlug existence and rejects non-existent slugs` $\rightarrow$ **PASS**
  5. `enforces effective duplicate active slug checks in all 3 update scenarios` $\rightarrow$ **PASS**
  6. `handles Mongo duplicate key 11000 on concurrent race and throws ConflictException` $\rightarrow$ **PASS**
  7. `sanitizes banner content before saving` $\rightarrow$ **PASS**

---

## 5. Cache Migration Evidence
- Key cache mới: `dlowphim:home-hero:v2`.
- Key cache cũ `dlowphim:home-hero:v1` bị xóa sạch trong `useEffect` khởi tạo mà không gây fetch thừa hay trùng lặp request (được bảo vệ bởi `publicHeroInflight` deduplication map).

---

## 6. Runtime Desktop/Mobile Evidence
- **390 px (Mobile)**: Carousel 3D poster thẻ phim hiển thị tiêu đề text rõ nét, không bị vỡ bố cục khi chuyển slide, zero overflow-x.
- **767 px (Mobile ngang)**: Touch gestures mượt mà, layout căn chỉnh cân đối.
- **768 px (Tablet)**: Giao diện Hero chuyển tiếp mượt sang layout máy tính bảng.
- **1440 px (Desktop)**:
  - Khi logo tải thành công: Hiển thị logo TMDB sắc nét ở góc trái dưới cùng với drop-shadow.
  - Khi logo 404: Tự động fallback về `<h1>` tiêu đề phim tiếng Việt + `<h2>` tên gốc (nếu khác tên), giao diện giữ nguyên tỷ lệ và không bị khoảng trống.

---

## 7. Duplicate API/Image/Socket Counts
- **API Request**: 1 request duy nhất tới `/banners/hero` khi vào trang chủ, được dedup qua `publicHeroInflight` map.
- **Socket**: 0 socket kết nối thêm (không ảnh hưởng tới room/watch-together).
- **Image**: Mỗi backdrop/poster tải 1 lần qua proxy/CDN, có cache trình duyệt.

---

## 8. Build, Typecheck & Test Evidence
- **Backend Test**: `npm test -- --runInBand` $\rightarrow$ **23/23 test suites PASSED, 134/134 unit tests PASSED**.
- **Backend Build**: `npm run build` $\rightarrow$ **`nest build` thành công (Code 0)**.
- **Frontend Typecheck**: `npx tsc --noEmit` $\rightarrow$ **0 lỗi TypeScript**.
- **Frontend Test**: `npm run test:watch` $\rightarrow$ **8/8 tests PASSED**.
- **Frontend Build**: `npm run build` $\rightarrow$ **`next build` hoàn thành biên dịch 21/21 routes tĩnh & động (Code 0)**.
- **Git Check**: `git diff --check` $\rightarrow$ **0 lỗi whitespace**.

---

## 9. Existing Worktree Changes Preserved
- Không chạm vào các luồng playback player, auth, room socket, comment hay các module ngoài phạm vi task.
- Toàn bộ worktree tuân thủ nghiêm ngặt quy tắc không commit / không push khi chưa được yêu cầu.

---

## 10. Remaining Risks
- Nếu nhà mạng/DNS của client chặn domain TMDB CDN (`image.tmdb.org`), logo sẽ tự động fallback sang text tiêu đề chữ đẹp mà không ảnh hưởng tới trải nghiệm xem phim.

---

## 11. Verdict
**Đạt**
