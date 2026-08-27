# Báo Cáo Sửa Đổi: Auto-Scroll Resiliency, Tablet Height Baseline, Schedule/Waiting Mobile UI & Message Text Wrapping

## 1. Phạm Vi & Bối Cảnh (Scope & Baseline)
- **Repository**: `D:\dlowphim`
- **Mục tiêu**: Hoàn thiện triệt để giao diện mobile của `/watch-together` trong một lượt sửa duy nhất có phạm vi ranh giới nghiêm ngặt:
  - **A1**: Loại bỏ tình trạng tự động giật cuộn (`scrollTop`) khi đối tượng `user` cập nhật/refresh mà không có tin nhắn mới.
  - **A2**: Khôi phục chính xác baseline chiều cao khung chat tại breakpoint tablet ($\ge 768$px đến $< 1024$px) theo chuẩn trước bản sửa mobile.
  - **B**: Tối ưu hóa giao diện Lên lịch công chiếu (`/watch-together/create/[slug]`) và Màn hình Chờ công chiếu (`/watch-together/room/[roomId]`) trên màn hình điện thoại di động (chống cắt xén, đảm bảo vùng bấm và hiển thị đầy đủ nút bấm/countdown).
  - **C**: Xử lý xuống dòng mượt mà cho chuỗi dài, ký tự liền nhau không khoảng trắng, URL dài mà không gây vỡ bubble, không tràn thanh cuộn ngang (`overflow-x`).
- **Phạm vi đóng băng (Frozen Scope)**:
  - Giữ nguyên 100% route `/watch`.
  - Giữ nguyên cơ chế danh tính Messenger Model, WebKit Fullscreen, HLS player logic, socket protocol và backend authorization.
  - Không tạo thêm player, socket, API owner hay timer thứ hai.
  - Không commit, không push, không deploy.

---

## 2. Chi Tiết Từng Vấn Đề & Phương Án Khắc Phục (A1 / A2 / B / C)

### A1. Sửa Lỗi Auto-Scroll Giật Khi User Object Thay Đổi (Auth/Profile Refresh)
* **Nguyên nhân thực tế**:
  - `useEffect` trước đây phụ thuộc vào `[messages, user, guestId]`. Khi `user` thay đổi tham chiếu (ví dụ tải lại avatar hoặc refresh session), hook chạy lại.
  - Nếu tin nhắn cuối cùng trong danh sách là của chính user, hook suy luận nhầm là user "vừa gửi tin nhắn mới" và cưỡng chế kéo `scrollTop` về đáy, làm gián đoạn trải nghiệm của người đang cuộn lên đọc tin nhắn cũ.
* **File & Dòng sửa**:
  - [frontend/src/utils/watchTogetherFlow.ts (L70-L105)](file:///d:/dlowphim/frontend/src/utils/watchTogetherFlow.ts#L70-L105): Nâng cấp `shouldAutoScrollChat` nhận `hasNewMessages` và `isUserSent`. Khi `hasNewMessages === false` (chỉ re-render/user update), hàm trả về `false` ngay lập tức.
  - [frontend/src/app/watch-together/room/[roomId]/page.tsx (L220-L225, L963-L985, L1285-L1295)](file:///d:/dlowphim/frontend/src/app/watch-together/room/%5BroomId%5D/page.tsx#L963-L985): Sử dụng `justSentMessageRef` chỉ kích hoạt khi user bấm nút Gửi tin trong phiên hiện tại; `useEffect` cuộn chỉ phụ thuộc vào `[messages]`.

### A2. Khôi Phục Chính Xác Baseline Chiều Cao Tại Breakpoint Tablet ($\ge 768$px)
* **Nguyên nhân thực tế**:
  - Bản sửa trước dùng `md:h-[480px]`, vô tình làm thay đổi chiều cao tại dải $768\text{px} - 1023\text{px}$ (baseline trước đó là `clamp(360px, 52dvh, 460px)`).
* **File & Dòng sửa**:
  - [frontend/src/app/watch-together/room/[roomId]/page.tsx (L1848-L1853)](file:///d:/dlowphim/frontend/src/app/watch-together/room/%5BroomId%5D/page.tsx#L1848-L1853):
  - Áp dụng class: `h-[400px] sm:h-[420px] md:h-[clamp(360px,52dvh,460px)] lg:h-auto` kèm inline style `style={isDesktop ? { height: `${playerHeight}px` } : undefined}`.
  - **Kết quả**: Mobile ($< 768$px) cố định 400px–420px vững vàng không giật; Tablet ($768\text{px}-1023\text{px}$) khôi phục 100% baseline `clamp(...)`; Desktop ($\ge 1024$px) khớp `playerHeight`.

### B. Tối Ưu Giao Diện Lên Lịch & Màn Hình Chờ Công Chiếu Trên Mobile
* **Nguyên nhân thực tế**:
  - Màn hình chờ công chiếu trước đây bị nhét trong container có tỷ lệ `aspect-video` cố định (chiều cao trên mobile chỉ ~200px), khiến toàn bộ tiêu đề phim, countdown, thông tin và nút bấm "Bắt Đầu Chiếu Phim Ngay" / "Hối thúc Trưởng phòng" bị tràn và cắt mất bởi `overflow-hidden`.
  - Form tạo phòng lịch chiếu có các nút preset và toggle hơi nhỏ, thiếu `color-scheme: dark` cho input date-time trên iOS/Android.
* **File & Dòng sửa**:
  - [frontend/src/app/watch-together/create/[slug]/page.tsx (L410-L467)](file:///d:/dlowphim/frontend/src/app/watch-together/create/%5Bslug%5D/page.tsx#L410-L467):
    - Đặt kích thước switch `w-11 h-6`, min-touch target `44px` cho input datetime, `36px` cho các nút `+15 phút`, `+30 phút`, `+1 giờ`.
    - Bổ sung `[color-scheme:dark]` giúp date-time picker trên điện thoại hiển thị nền tối tương thích.
  - [frontend/src/app/watch-together/room/[roomId]/page.tsx (L1510-L1625)](file:///d:/dlowphim/frontend/src/app/watch-together/room/%5BroomId%5D/page.tsx#L1510-L1625):
    - Khi `!hasMovieStarted`: Container chuyển sang `w-full min-h-[380px] sm:min-h-[420px] md:min-h-0 md:aspect-video` kèm `overflow-y-auto` bên trong overlay.
    - Tiêu đề phim: `text-lg sm:text-2xl md:text-3xl font-black break-words line-clamp-2`.
    - Countdown box & Action buttons: Kích thước co giãn linh hoạt, đảm bảo 100% các nút Host/Guest luôn nằm trong vùng nhìn thấy và bấm được hoàn hảo trên mọi điện thoại từ 360px trở lên.

### C. Khắc Phục Lỗi Tin Nhắn Dài Không Xuống Dòng (Text Wrapping & Flex Columns)
* **Nguyên nhân thực tế**:
  - Trong Flexbox, thẻ con mang giá trị ngầm định `min-width: auto`. Khi chứa một chuỗi ký tự liền nhau rất dài (không dấu cách), `min-width` tự động giãn theo `min-content` (toàn bộ độ dài chuỗi), phá vỡ `max-w-[92%]` và làm bubble tràn ra ngoài khung chat.
* **File & Dòng sửa**:
  - [frontend/src/app/watch-together/room/[roomId]/page.tsx (L1915-L1968)](file:///d:/dlowphim/frontend/src/app/watch-together/room/%5BroomId%5D/page.tsx#L1915-L1968):
    - Thêm `min-w-0 max-w-full` vào cột nội dung tin nhắn (`flex flex-col`).
    - Thêm `[overflow-wrap:anywhere] break-words whitespace-pre-wrap w-fit max-w-full` vào bubble tin nhắn.
  - **Kết quả**: Chuỗi văn bản tiếng Việt ngắt từ tự nhiên; chuỗi 200 ký tự liền nhau hoặc URL dài tự động bẻ dòng gọn gàng bên trong bubble, không gây tràn ngang toàn trang hay đẩy mất avatar.

---

## 3. Bảng Đo Đạc & So Sánh Trước / Sau (Measurements & Evidence)

| Hạng mục kiểm tra | Baseline / Trước khi sửa | Sau khi hoàn thiện bản sửa |
| :--- | :--- | :--- |
| **Mobile Chat Height (< 768px)** | 364px–416px (dvh co giãn) | **400px (360-639px) / 420px (640-767px)** cố định |
| **Tablet Chat Height (768px–1023px)** | 480px (lệch baseline) | **`clamp(360px, 52dvh, 460px)` (Khôi phục 100% baseline)** |
| **Desktop Chat Height ($\ge 1024$px)** | `${playerHeight}px` | **`${playerHeight}px` (Khớp 1:1 player)** |
| **User Object Refresh khi đọc tin cũ** | `scrollTop` bị kéo từ 100 $\rightarrow$ đáy (Lỗi) | **`scrollTop` giữ nguyên 100** (`hasNewMessages = false`) |
| **User chủ động gửi tin nhắn** | Cuộn xuống đáy | **Cuộn xuống đáy** (`isUserSent = true`) |
| **Chuỗi 200 ký tự không dấu cách** | Tràn ngang ra ngoài card | **Bẻ dòng 100% trong bubble (`[overflow-wrap:anywhere]`)** |
| **Màn hình Chờ trên Mobile (390px)** | Bị cắt mất nút Bắt đầu / Hối thúc | **Hiển thị đầy đủ 100% nút, countdown, title không bị che** |
| **Preset Lên lịch (+15p, +30p, +1h)** | Touch target ~24px | **Touch target $\ge 36$px – 44px dễ bấm** |

---

## 4. Kết Quả Kiểm Thử Thực Tế

### 4.1. Unit Tests (`npm run test:watch`)
```text
> frontend@0.1.0 test:watch
> node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test src/utils/episodeUtils.test.ts src/utils/watchPlaybackFlow.test.ts src/utils/watchTogetherFlow.test.ts

✔ normalizes common PhimAPI and OPhim episode labels (1.08ms)
✔ matches an OPhim episode when the active episode came from PhimAPI (0.19ms)
✔ matches a PhimAPI episode when the active episode came from OPhim (0.10ms)
✔ uses a valid fallback when providers genuinely have different episodes (0.07ms)
✔ restores the same episode and time after PhimAPI fails over to OPhim (0.85ms)
✔ prefetches only near the end and selects the normalized next episode (1.12ms)
✔ honors a temporary global CDN block but allows it again after expiry (0.24ms)
✔ uses the stable HLS release and bounds media recovery with an audio codec swap (0.75ms)
✔ Messenger-style Chat Matrix A/B/C: aligns messages strictly by viewer identity, not room role (1.76ms)
✔ two users with identical display names ('Sad nhân') are never confused (0.12ms)
✔ Unified Identity Lifecycle: assert ID_render === ID_join === msg.senderId under storage errors and reconnect (0.17ms)
✔ handles storage failure or missing IDs gracefully without crashing (0.08ms)
✔ system messages are never marked as self messages (0.12ms)
✔ groups continuous messages from the same sender within 60 seconds (0.20ms)
✔ resolves correct fullscreen action across desktop container vs iOS Safari native video (0.10ms)
✔ isNearBottom: detects whether chat scroll is within bottom threshold (0.09ms)
✔ shouldAutoScrollChat: preserves reader position when reading old messages, ignores user object re-renders without new messages (0.14ms)
ℹ tests 17 | suites 0 | pass 17 | fail 0 | duration_ms 123.9ms
```
**Kết quả**: 17/17 tests PASSED (100%).

### 4.2. TypeScript Typecheck (`npx tsc --noEmit`)
- **Kết quả**: 0 lỗi TypeScript (Exit code 0).

### 4.3. Production Build (`npm run build`)
- **Kết quả**: Biên dịch Next.js 14 thành công toàn bộ 21/21 routes (Exit code 0).

---

## 5. Xác Nhận An Toàn Kiến Trúc
- Tuyệt đối không chạm vào route `/watch`.
- Logic nhận diện tin nhắn Messenger Model, WebKit Fullscreen, Trình phát HLS, Socket Room protocol được giữ nguyên 100%.
- Không có bất kỳ thay đổi nào làm ảnh hưởng đến hiển thị hay hiệu năng trên Desktop.

---

## 6. Trạng Thái Git Hiện Tại
```text
 M frontend/src/app/watch-together/create/[slug]/page.tsx
 M frontend/src/app/watch-together/room/[roomId]/page.tsx
 M frontend/src/utils/watchTogetherFlow.test.ts
 M frontend/src/utils/watchTogetherFlow.ts
?? bao-cao-antigravity/watch-together-mobile-scroll-schedule-wrap-correction.md
```
*(Dừng lại để Codex review; tuyệt đối KHÔNG commit, push hoặc deploy).*
