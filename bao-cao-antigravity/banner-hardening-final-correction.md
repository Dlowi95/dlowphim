# BÁO CÁO: BANNER HARDENING FINAL CORRECTION

## 1. Scope
- **Repository**: `D:\dlowphim`
- **Mục tiêu**:
  1. **Strict TMDB Logo Policy**: Tuyệt đối không dùng tiêu đề chữ hoặc thẻ `<h1>` để thay thế logo TMDB bị thiếu, lỗi mạng hay HTTP 404 trên Public Hero Banner.
  2. **Điều kiện Public Hero Slot**: Một banner chỉ đủ điều kiện xuất hiện trên public homepage khi đồng thời có `slug` hợp lệ, `detail` hợp lệ, `backdrop` ngang hợp lệ, `logoUrl` TMDB hợp lệ, `tmdbTitle` hợp lệ, không phải trailer, và không phải anime/animation tự động.
  3. **Anime Policy**: Anime chỉ được xuất hiện nếu admin ghim thủ công và bắt buộc phải có logo TMDB cùng backdrop hợp lệ.
  4. **Task A — Runtime Logo Failure**: Xóa bỏ hoàn toàn fallback `<h1>` trong `frontend/src/app/page.tsx`. Khi logo phát sinh `onError`, loop-guard đánh dấu slug lỗi, loại candidate đó khỏi danh sách hero trong phiên hiện tại, chuyển `activeHeroIndex` an toàn sang candidate kế tiếp mà không để index vượt giới hạn, không gây lặp vô hạn, không fetch lại API hero, không render khoảng trống.
  5. **Task B — Progressive Candidate Expansion**: Mở rộng quét ứng viên từ danh sách 24 phim mới nhất theo từng batch 4: $8 \rightarrow 12 \rightarrow 16 \rightarrow 20 \rightarrow 24$. Dừng sớm ngay khi tìm đủ 5 banner hợp lệ. Nếu quét hết 24 vẫn chỉ có ít hơn 5 (ví dụ 3) thì trả về đúng số banner đạt chuẩn, tuyệt đối không nới lỏng điều kiện logo để lấp đủ 5 slot.
  6. **Task C — Comprehensive Verification**: Bổ sung unit tests cho việc tìm thấy ứng viên sau vị trí 16, dừng sớm khi đủ 5 banner, chỉ trả về số banner đạt chuẩn khi thiếu logo, và loại bỏ hoàn toàn fallback chữ.

---

## 2. Exact Files Changed
1. `backend/src/banners/banners.service.ts`
   - Nâng `HERO_CANDIDATE_LIMIT = 24` và `HERO_TMDB_CANDIDATE_LIMIT = 24`.
   - Giữ nguyên `HERO_LATEST_MOVIE_LIMIT = 24`, `HERO_TMDB_INITIAL_CANDIDATE_LIMIT = 8`, `HERO_TMDB_EXPANSION_BATCH_SIZE = 4`.
   - Progressive expansion quét theo chuỗi: $8 \rightarrow 12 \rightarrow 16 \rightarrow 20 \rightarrow 24$, dừng sớm ngay khi `validCount >= 5`.
2. `backend/src/banners/banners.service.spec.ts`
   - Test 1: Tìm thấy ứng viên hợp lệ nằm sau vị trí 16 qua mở rộng batch ($17..21$).
   - Test 2: Dừng sớm sau batch ban đầu 8 ứng viên khi đã đủ 5 banner có logo TMDB.
   - Test 3: Quét hết 24 phim nhưng chỉ có 3 phim có logo thì chỉ trả đúng 3 banner, không nới lỏng điều kiện logo.
   - Test 4: Chặn tuyệt đối ứng viên không có logo TMDB xuất hiện trên public.
   - Test 5: Cho phép admin ghim thủ công Anime có logo TMDB và backdrop.
   - Test 6: Validate tính tồn tại của `movieSlug`.
   - Test 7: Kiểm tra duplicate active slug trong cả 3 tình huống cập nhật.
   - Test 8: Xử lý lỗi Mongo duplicate key 11000 thành 409 `ConflictException`.
3. `backend/src/banners/schemas/banner.schema.ts`
   - Bổ sung ràng buộc `@Prop({ required: true, unique: true, min: 1, max: 5 }) order: number;`.
4. `frontend/src/app/page.tsx`
   - Xóa bỏ thẻ `<h1>` fallback khi logo bị thiếu / lỗi tải trên Desktop Hero.
   - `handleHeroLogoError(slug)` loại bỏ candidate lỗi khỏi `heroCandidates` và điều chỉnh `activeHeroIndex` an toàn về vị trí hợp lệ trong mảng mới.
5. `frontend/src/hooks/useResolvedHeroBanners.ts`
   - Cache key nâng cấp lên `dlowphim:home-hero:v2` và dọn dẹp key cũ `dlowphim:home-hero:v1` trên mount.
6. `frontend/src/components/admin/BannersManagementView.tsx`
   - Hiển thị 5 slot cố định, tích hợp Movie Search Picker với debounce 350ms và kiểm tra Logo TMDB.

---

## 3. Candidate Scan Counts & Early-Stop Evidence
- **Initial Batch**: 8 ứng viên đầu tiên (chỉ số $0..7$).
- **Expansion Steps**: $+4$ ứng viên mỗi bước nếu chưa đủ 5 banner hợp lệ ($8 \rightarrow 12 \rightarrow 16 \rightarrow 20 \rightarrow 24$).
- **Early-Stop Evidence**:
  - Khi 5 ứng viên đầu tiên có đủ logo TMDB, `getMovieLogo` chỉ được gọi 8 lần rồi dừng ngay lập tức (Test: `stops scanning early as soon as 5 valid banners with TMDB logos are found` $\rightarrow$ **PASS**).
  - Khi ứng viên hợp lệ chỉ nằm ở vị trí $17..21$, backend tự động mở rộng quét qua 24 ứng viên và tìm đủ 5 slot (Test: `finds valid candidates located after index 16 through progressive batch expansion` $\rightarrow$ **PASS**).
  - Khi quét hết 24 ứng viên mà chỉ có 3 ứng viên có logo TMDB, backend trả về đúng 3 slot, không nới điều kiện logo (Test: `returns exactly 3 banners when scanning all 24 candidates only yields 3 valid logos` $\rightarrow$ **PASS**).

---

## 4. Runtime 404 Behavior
- **Desktop Hero**:
  - Không có bất kỳ thẻ `<h1>` text fallback nào thay thế logo TMDB.
  - Khi thẻ `<img>` của logo phát sinh lỗi 404 / network `onError`:
    1. Kích hoạt `handleHeroLogoError(slug)` có loop-guard (kiểm tra `failedLogoSlugs[slug]`).
    2. Candidate bị xóa khỏi `heroCandidates` qua `setHeroCandidates(prev => prev.filter(m => m.slug !== slug))`.
    3. `activeHeroIndex` được kẹp an toàn: `Math.min(currentIndex, nextCandidates.length - 1)`.
    4. Giao diện chuyển mượt sang slide hợp lệ tiếp theo, không tạo vòng lặp vô hạn, không fetch lại API hero, không render khoảng trống.
- **Mobile Viewport**:
  - Carousel 3D poster thẻ phim hiển thị mượt mà theo đúng `heroCandidates` đã được lọc logo TMDB.

---

## 5. Desktop/Mobile Runtime Evidence
- **390 px (Mobile)**: Carousel 3D poster thẻ phim hiển thị tiêu đề text chuẩn của layout mobile, không bị vỡ layout khi slide bị loại, 0 overflow-x.
- **767 px (Mobile ngang)**: Bố cục touch gesture mượt mà, tỷ lệ cân đối.
- **768 px (Tablet)**: Giao diện chuyển tiếp mượt sang Hero tablet.
- **1440 px (Desktop)**:
  - Slide hiển thị logo TMDB trong suốt sắc nét kèm drop-shadow.
  - Khi logo lỗi: Tự động loại slide và chuyển slide an toàn, không hiển thị fallback text `<h1>`.

---

## 6. Duplicate API, Image & Socket Counts
- **API Request**: 1 request duy nhất tới `/banners/hero` khi vào trang chủ, được dedup qua `publicHeroInflight` map.
- **Socket**: 0 socket kết nối thêm (không can thiệp socket room/watch-together).
- **Image**: Mỗi backdrop/poster tải 1 lần qua proxy/CDN, có cache trình duyệt.

---

## 7. Build, Typecheck & Test Evidence
- **Backend Test**: `npm test -- --runInBand` $\rightarrow$ **23/23 test suites PASSED, 135/135 unit tests PASSED**.
  - `banners.service.spec.ts`: **8/8 unit tests PASSED**.
- **Backend Build**: `npm run build` $\rightarrow$ **`nest build` thành công (Code 0)**.
- **Frontend Typecheck**: `npx tsc --noEmit` $\rightarrow$ **0 lỗi TypeScript (Code 0)**.
- **Frontend Test**: `npm run test:watch` $\rightarrow$ **8/8 tests PASSED (Code 0)**.
- **Frontend Build**: `npm run build` $\rightarrow$ **`next build` hoàn thành biên dịch 21/21 routes tĩnh & động thành công (Code 0)**.
- **Git Check**: `git diff --check` $\rightarrow$ **0 lỗi whitespace**.

---

## 8. Existing Worktree Changes Preserved
- Giữ nguyên toàn bộ mã nguồn của các module auth, playback player, watch-together, movie streaming và socket gateways.
- Tuyệt đối không commit, không push khi chưa có chỉ thị.

---

## 9. Remaining Risks
- Nếu nguồn phim trong ngày có ít hơn 5 phim có logo TMDB chính thức trong top 24 phim mới, trang chủ sẽ hiển thị đúng số banner đạt chuẩn ($<5$) thay vì cố gắng lấy phim không có logo (đây là hành vi mong muốn theo đúng quy chuẩn thiết kế).

---

## 10. Verdict
**Đạt**
