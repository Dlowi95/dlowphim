# QUY TẮC PHÁT TRIỂN & THỐNG NHẤT KIẾN TRÚC DLOWPHIM (AGENTS.MD)

Tài liệu này ghi nhận toàn bộ các quy chuẩn, kiến trúc hệ thống và quyết định kỹ thuật đã thống nhất cho dự án **DlowPhim**. Tất cả AI Agents và Developers khi làm việc trên codebase này BẮT BUỘC tuân thủ nghiêm ngặt các quy tắc sau:

---

## 1. QUY ĐỊNH TRÌNH PHÁT VIDEO (HLS PLAYER & EMBED SERVER)

### 1.1. Ưu tiên HLS Player (`hls.js` + `Plyr.js`) làm Trình Phát Mặc Định
* **HLS Player (`playerType = "hls"`) LÀ TRÌNH PHÁT CHÍNH MẶC ĐỊNH**:
  * Khi tập phim có sẵn đường dẫn `link_m3u8`, hệ thống **phải ưu tiên phát bằng HLS Player xịn (`Plyr.js` kết hợp `hls.js`)**.
  * HLS Player cung cấp đầy đủ các tính năng xem phim cao cấp:
    - Điều chỉnh chất lượng video (`1080p`, `720p`, `480p`, `360p`)
    - Điều chỉnh tốc độ phát (`0.5x` đến `2.0x`)
    - Chế độ Rạp Chiếu Phim (Cinema Mode)
    - Tự động lưu và phát tiếp tiến trình xem phim (Resume Watch Progress)
    - Tự động chuyển tập tiếp theo khi kết thúc (Autoplay Next Episode)
    - Tự động bỏ qua đoạn giới thiệu (Skip Intro)

### 1.2. Cơ chế Chuyển đổi Server Embed Iframe Dự Phòng (Audio / Stream Backup)
* **Xử lý âm thanh Dolby Digital AC3 5.1 & Stream Lag**:
  * Một số bản phim Rip iTunes/WEB-DL cũ sử dụng codec âm thanh Dolby AC3 5.1 (không hỗ trợ giải mã trực tiếp trên trình duyệt Chrome/Firefox HTML5).
  * Cung cấp nút bấm chuyển đổi **"Server Embed (Âm thanh HD) / Server HLS Player"** ngay bên dưới player để người dùng chủ động linh hoạt đổi sang Server Embed Iframe khi cần nghe âm thanh mã hóa lại hoặc khi luồng m3u8 bị giật lag.

---

## 2. QUẢN LÝ NGUỒN CÀO PHIM & SMART PROXY FALLBACK

### 2.1. Nguồn Phim Mặc Định (Active Movie Source)
* Nguồn cào phim hoạt động mặc định của toàn bộ website là **OPhim** (`ophim1.com`).
* Nguồn dự phòng tự động (Auto Fallback) là **PhimAPI** (`phimapi.com`).
* Cấu hình Nguồn Active được lưu trữ và quản lý trực tiếp trong MongoDB (`SystemSetting`), cho phép Admin thay đổi tức thì từ Admin Panel mà không cần sửa code.

### 2.2. Smart Proxy Path Rewriter
* Backend NestJS Proxy (`movies.service.ts`) tự động bắt và chuyển đổi tiền tố đường dẫn tương thích:
  - Khi nguồn active là `phimapi`: Rewrite đường dẫn request dạng `/v1/api/phim/:slug` thành `/phim/:slug`.
  - Khi nguồn active là `ophim`: Rewrite đường dẫn request dạng `/phim/:slug` thành `/v1/api/phim/:slug`.

### 2.3. Tự Động Xử Lý Domain Stream OPhim Cũ Bị Chết DNS (`ERR_NAME_NOT_RESOLVED`)
* Khi mảng tập phim từ OPhim chứa domain CDN stream cũ đã hỏng (như `vip.opstream11.com`), Frontend trang `/watch/[slug]` tự động gọi API PhimAPI (`phimapi.com/phim/:slug`) và chèn các **Server Vietsub (Dự Phòng)** & **Server Thuyết Minh (Dự Phòng)** nét căng vào danh sách Server.

---

## 3. CƠ CHẾ 4 LỚP NẠP POSTER / THUMBNAIL PHIM (MULTI-LAYER POSTER FALLBACK)

Để đảm bảo 100% mọi bộ phim trên Trang Chủ, Trang Chi Tiết, Trang Tìm Kiếm, và Trang Cá Nhân User (Yêu Thích, Lịch Sử Xem, Danh Sách Xem) **LUÔN CÓ ẢNH POSTER NẾT CĂNG, KHÔNG BAO GIỜ BỊ LỖI 404 HOẶC HIỆN ẢNH RẠP PHIM NỀN ĐỎ MẶC ĐỊNH**:
1. **Lớp 1**: Quét ảnh từ API OPhim chính (`/phim/:slug`).
2. **Lớp 2**: Quét ảnh từ API OPhim v1 (`/v1/api/phim/:slug`).
3. **Lớp 3**: Quét ảnh từ PhimAPI dự phòng (`phimapi.com/phim/:slug`).
4. **Lớp 4**: Nếu cả 3 API chưa trả về `thumb_url`/`poster_url`, Frontend/Card tự động gọi Backend Proxy TMDB (`/movies/logo/:slug`) để cào ảnh Poster/Backdrop chính thức chuẩn quốc tế từ TMDB về hiển thị.

---

## 4. TỰ ĐỘNG DỊCH MÔ TẢ PHIM TIẾNG ANH SANG TIẾNG VIỆT
* Khi người dùng xem chi tiết bộ phim có mô tả bằng Tiếng Anh, Backend Interceptor (`movies.service.ts`) tự động kết nối qua Google Translate API dịch sang Tiếng Việt chuẩn mực và lưu bản dịch vĩnh viễn vào Database.

---

## 5. LỌC DANH MỤC PHIM CHIẾU RẠP & PHIM SẮP CHIẾU
* **Hàng Phim Sắp Chiếu (`UpcomingRow.tsx`)**: Cố định fetch danh sách từ OPhim API (`danh-sach/phim-sap-chieu`), chuyên hiển thị phim Trailer / Sắp ra mắt (có Player Trailer YouTube tự động nhúng).
* **Hàng Phim Chiếu Rạp (`CinemaRow.tsx`)**: Tự động loại bỏ 100% các phim chỉ có Trailer (`episode_current.includes('trailer')` hoặc `last_episodes` rỗng). Chỉ hiển thị các bộ phim chiếu rạp **ĐÃ CÓ PHIM ĐỂ XEM THỰC SỰ**.

---

## 6. CÁC TÍNH NĂNG ĐÃ LOẠI BỎ (DEPRECATED)
* Tính năng Tokusatsu / Kamen Rider (`FeaturedRidersModule`, `<KamenRiderRow />`) đã được gỡ bỏ hoàn toàn khỏi hệ thống. Không thêm lại tính năng này.
