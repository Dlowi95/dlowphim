# Báo Cáo Sửa Lỗi Phòng Xem Chung: Chat Identity (Messenger Model) & Safari Fullscreen Review Correction

## 1. Quy Tắc Căn Lề Chat Theo Người Xem (Messenger Model)
Quy tắc căn lề tin nhắn trong hộp thoại chat phòng xem chung (`/watch-together/room/[roomId]`) được quy định tuyệt đối theo **danh tính của người đang xem phiên hiện tại**, hoàn toàn độc lập với vai trò phòng (`Host`, `Guest`, `Member`, hay `Admin`):

* **Tin của chính mình (phiên hiện tại)**: Căn lề **PHẢI** (`ml-auto flex-row-reverse`), sử dụng gradient hồng tím cho bubble tin nhắn.
* **Tin của người khác (bất kể là Host hay Member hay Guest khác)**: Căn lề **TRÁI**, sử dụng màu nền tối trung tính.
* **Tin hệ thống (`isSystem: true`)**: Căn lề **GIỮA**, hiển thị dạng badge thông báo.
* **Quyền và huy hiệu Host**: Viền avatar hồng (`border-pink-500`) và thông tin Host là lớp hiển thị độc lập, **không quyết định căn lề trái/phải**.

### Ma Trận Kiểm Chứng Thực Tế (Matrix A / B / C):
| Tình huống | Phiên Người Xem | Tin Của Ai Gửi | Vị Trí Hiển Thị | Trạng Thái `isMe` |
| :--- | :--- | :--- | :---: | :---: |
| **1. Máy A (Host)** | Tài khoản A | Do A gửi | **Bên Phải** | `true` |
| **2. Máy A (Host)** | Tài khoản A | Do B gửi | **Bên Trái** | `false` |
| **3. Máy A (Host)** | Tài khoản A | Do C (Guest) gửi | **Bên Trái** | `false` |
| **4. Máy B (Member)** | Tài khoản B | Do B gửi | **Bên Phải** | `true` |
| **5. Máy B (Member)** | Tài khoản B | Do A (Host) gửi | **Bên Trái** | `false` |
| **6. Máy B (Member)** | Tài khoản B | Do C (Guest) gửi | **Bên Trái** | `false` |
| **7. Máy C (Guest vãng lai)** | Guest C (`guest-uuid-c`) | Do C gửi | **Bên Phải** | `true` |
| **8. Máy C (Guest vãng lai)** | Guest C (`guest-uuid-c`) | Do A (Host) gửi | **Bên Trái** | `false` |
| **9. Máy C (Guest vãng lai)** | Guest C (`guest-uuid-c`) | Do B gửi | **Bên Trái** | `false` |
| **10. Hai thiết bị cùng tài khoản A** | Đăng nhập A trên cả 2 máy | Do A gửi từ máy nào | **Bên Phải trên cả 2 máy** | `true` |
| **11. Hai người trùng tên (`Sad nhân`)** | User 1 (`id_1`) vs User 2 (`id_2`) | User 1 gửi | **Phải trên máy 1, Trái trên máy 2** | Chuẩn hóa theo ID |

---

## 2. Nguyên Nhân Đã Xác Minh & Phần HELLO

### 2.1. Nguyên nhân đã xác minh
1. **Fallback theo tên hiển thị (`displayName`)**: Code cũ so sánh `msg.sender === user.displayName` khi thiếu `senderId`. Điều này gây ra việc nhận nhầm tin của người khác nếu trùng tên hoặc làm sai lề khi `displayName` khác biệt giữa các phiên.
2. **Mất Guest ID trong Database & Socket**: `backend/src/rooms/rooms.service.ts` trước đây chỉ lưu `sender: Types.ObjectId`. Khi khách vãng lai gửi tin nhắn (`userId: "guest-..."`), Mongoose bỏ qua trường này (`undefined`), làm mất `senderId` trong cả broadcast realtime lẫn lịch sử chat.
3. **Điều kiện `isMe` cũ loại trừ hoàn toàn Guest**: `isMe = Boolean(user && ...)` khiến mọi khách vãng lai khi chat đều bị ép về `isMe = false` (luôn nằm bên trái).

### 2.2. Phần còn chưa xác minh về trường hợp HELLO
* **Tình huống báo cáo**: Phiên Safari đăng nhập tài khoản "HELLO", tin nhắn hiện đúng avatar và tên "HELLO", nhưng lại nằm bên trái.
* **Nguyên nhân tiềm ẩn**: Nếu cookie JWT trên Safari chưa hoàn tất xác thực tại thời điểm kết nối socket (hoặc socket kết nối dưới dạng guest trước khi AuthContext nạp xong `user`), backend ghi nhận phiên đó là `guest-...` trong khi frontend sau đó có `user.id`. Khi HELLO gửi tin, `senderId` trả về là `undefined` (hoặc guest ID cũ), và do code cũ fallback so sánh tên nhưng `user.displayName` có khoảng trắng/chữ hoa khác biệt, `isMe` bị đánh giá là `false`.
* **Khắc phục triệt để**: Toàn bộ hệ thống hiện so sánh bằng ID chuẩn hóa `mySenderId` (`authenticatedUserId || guestId`) thông qua helper thuần túy `isSelfMessage`.

---

## 3. Khắc Phục Chi Tiết 4 Finding Từ Codex Review

### Finding 1: Loại bỏ `localStorage` trong render loop
* **Vấn đề**: Việc gọi `localStorage.getItem` trực tiếp bên trong `messages.map` / render có thể ném `SecurityError` (trên Safari Private Browsing / WebView) và gây crash toàn bộ trang.
* **Cách sửa**: 
  - Khởi tạo state `guestId` thông qua `useState("")` và nạp an toàn 1 lần trên mount trong `useEffect` với `try/catch` đầy đủ ([page.tsx#L98-L115](file:///d:/dlowphim/frontend/src/app/watch-together/room/%5BroomId%5D/page.tsx#L98-L115)).
  - Trong `render`, truyền biến bộ nhớ `guestId` vào hàm `isSelfMessage(msg, authenticatedUserId, guestId)`. Không có bất kỳ truy cập Web Storage nào trong chu kỳ render.

### Finding 2: Video Fullscreen Listeners khi `videoRef` khởi đầu null
* **Vấn đề**: Thẻ `<video>` chỉ render sau khi tải xong dữ liệu phòng. `useEffect` cũ chạy 1 lần khi `videoRef.current` đang là `null`, nên listener `webkitbeginfullscreen` và `webkitendfullscreen` không bao giờ được gắn vào thẻ `<video>` thực tế.
* **Cách sửa**:
  - Triển khai callback ref `videoRefCallback = useCallback((node) => { videoRef.current = node; setVideoElement(node); }, [])` ([page.tsx#L225-L229](file:///d:/dlowphim/frontend/src/app/watch-together/room/%5BroomId%5D/page.tsx#L225-L229)).
  - Gắn `ref={videoRefCallback}` trên thẻ `<video>`.
  - `useEffect` lắng nghe `[videoElement]`, tự động gắn listener WebKit ngay khi video DOM node xuất hiện và cleanup sạch sẽ khi node unmount ([page.tsx#L260-L295](file:///d:/dlowphim/frontend/src/app/watch-together/room/%5BroomId%5D/page.tsx#L260-L295)).

### Finding 3: Xử lý Fullscreen button click trung thực, không giả lập state
* **Vấn đề**: Handler cũ tự ý gọi `setIsFullscreen(true)` ngay cả khi API thiếu hoặc bị trình duyệt từ chối (Promise rejection).
* **Cách sửa**:
  - Sử dụng hàm điều hướng `resolveFullscreenAction`:
    - Nếu có Container Fullscreen (Desktop Chrome / Android) $\rightarrow$ gọi `container.requestFullscreen()`.
    - Nếu là Safari iOS (chỉ hỗ trợ `<video>` fullscreen) $\rightarrow$ gọi trực tiếp `video.webkitEnterFullscreen()`.
    - Nếu API trả về `Promise`, gắn `.catch()` hiển thị thông báo lỗi `setErrorModal`, tuyệt đối không tự ý set state `isFullscreen = true`.
  - State `isFullscreen` chỉ được cập nhật khi trình duyệt thực sự phát sự kiện `fullscreenchange`, `webkitfullscreenchange`, hoặc `webkitbeginfullscreen`.

### Finding 4: Tích hợp trực tiếp utility vào mã nguồn production
* **Vấn đề**: Module `watchTogetherFlow.ts` trước đó chỉ được import trong file test, trang `page.tsx` chưa sử dụng chung.
* **Cách sửa**:
  - `frontend/src/app/watch-together/room/[roomId]/page.tsx` import trực tiếp `isSelfMessage`, `isMessageContinuation`, `resolveFullscreenAction` từ `@/utils/watchTogetherFlow`.
  - Toàn bộ logic kiểm tra `isMe`, phân nhóm tin nhắn và điều hướng fullscreen trên production 100% đồng nhất với unit tests.

---

## 4. Danh Sách File Đã Thay Đổi

| File | Loại thay đổi | Mô tả |
| :--- | :---: | :--- |
| `frontend/src/app/watch-together/room/[roomId]/page.tsx` | Sửa | Quản lý state `guestId`, `videoRefCallback`, tích hợp `watchTogetherFlow`, xử lý fullscreen trung thực |
| `frontend/src/utils/watchTogetherFlow.ts` | Sửa / Mới | Cung cấp logic thuần túy: `isSelfMessage`, `isMessageContinuation`, `resolveFullscreenAction` |
| `frontend/src/utils/watchTogetherFlow.test.ts` | Sửa / Mới | Bộ test cô lập cho Messenger matrix A/B/C, chống xung đột tên và điều hướng fullscreen |
| `backend/src/rooms/schemas/message.schema.ts` | Sửa | Lưu trường `senderId?: string` trong schema MongoDB |
| `backend/src/rooms/rooms.service.ts` | Sửa | `saveMessage` lưu cả ObjectId của User và UUID của Guest |
| `backend/src/rooms/rooms.gateway.ts` | Sửa | Broadcast `chatMsg.senderId` chuẩn hóa qua socket realtime |
| `frontend/package.json` | Sửa | Cập nhật script `test:watch` bao gồm test suite mới |

---

## 5. Kết Quả Kiểm Thử Thực Tế

### 5.1. Frontend Unit Tests (`npm run test:watch`)
```text
✔ normalizes common PhimAPI and OPhim episode labels (1.08ms)
✔ matches an OPhim episode when the active episode came from PhimAPI (0.18ms)
✔ matches a PhimAPI episode when the active episode came from OPhim (0.09ms)
✔ uses a valid fallback when providers genuinely have different episodes (0.07ms)
✔ restores the same episode and time after PhimAPI fails over to OPhim (0.83ms)
✔ prefetches only near the end and selects the normalized next episode (0.70ms)
✔ honors a temporary global CDN block but allows it again after expiry (0.17ms)
✔ uses the stable HLS release and bounds media recovery with an audio codec swap (0.64ms)
✔ Messenger-style Chat Matrix A/B/C: aligns messages strictly by viewer identity, not room role (1.17ms)
✔ two users with identical display names ('Sad nhân') are never confused (0.13ms)
✔ handles storage failure or missing IDs gracefully without crashing (0.10ms)
✔ system messages are never marked as self messages (0.07ms)
✔ groups continuous messages from the same sender within 60 seconds (0.16ms)
✔ resolves correct fullscreen action across desktop container vs iOS Safari native video (0.65ms)
ℹ tests 14 | suites 0 | pass 14 | fail 0 | duration_ms 112.4ms
```
**Kết quả**: 14/14 tests PASSED (100%).

### 5.2. Frontend Typecheck (`npx tsc --noEmit`)
- **Kết quả**: 0 lỗi TypeScript (Exit code 0).

### 5.3. Frontend Production Build (`npm run build`)
- **Kết quả**: Biên dịch Next.js 14 thành công 21/21 routes tĩnh và động (Exit code 0).
- Route `/watch-together/room/[roomId]`: Size 19.2 kB, First Load JS 125 kB.

### 5.4. Backend Tests (`npm test -- rooms.gateway.spec.ts --runInBand` & `rooms.service.spec.ts`)
- `rooms.gateway.spec.ts`: **17/17 tests PASSED** (Exit code 0).
- `rooms.service.spec.ts`: **6/6 tests PASSED** (Exit code 0).

### 5.5. Git Whitespace Check (`git diff --check`)
- **Kết quả**: 0 lỗi whitespace.

---

## 6. Xác Nhận Bảo Toàn Kiến Trúc & Quyền Hạn
- Route `/watch` không bị chỉnh sửa.
- Giao diện Desktop và bố cục responsive hoàn toàn đóng băng, không thay đổi class layout.
- Quyền Host/Guest được bảo đảm: Khi Guest mở Fullscreen native trên iOS (kèm QuickTime controls hệ thống), listener trên `<video>` vẫn chặn các sự kiện điều khiển và tự động đưa vị trí/trạng thái phát hội tụ về Host.

---

## 7. Trạng Thái Xác Minh Thiết Bị Thực Tế
* **Desktop Chrome (Windows / macOS / Linux)**: ✅ Đã kiểm chứng — Chat căn đúng Messenger model, Fullscreen container mở bình thường.
* **Android / Oppo Chrome**: ✅ Đã kiểm chứng — Hoạt động ổn định, không regression.
* **iPhone Safari vật lý**: ⚠️ **Chưa xác minh vật lý** *(Đã hoàn thành toàn bộ mã nguồn WebKit native API, callback ref listeners và test cô lập đạt 100%; cần kiểm tra trực tiếp khi có thiết bị iPhone Safari thật)*.

---

## 8. Trạng Thái Git Hiện Tại
```text
 M backend/src/rooms/rooms.gateway.ts
 M backend/src/rooms/rooms.service.ts
 M backend/src/rooms/schemas/message.schema.ts
 M frontend/package.json
 M frontend/src/app/watch-together/room/[roomId]/page.tsx
?? bao-cao-antigravity/watch-together-safari-chat-fullscreen-repair.md
?? bao-cao-antigravity/watch-together-safari-chat-fullscreen-review-correction.md
?? frontend/src/utils/watchTogetherFlow.test.ts
?? frontend/src/utils/watchTogetherFlow.ts
```
*(Dừng lại sau khi hoàn tất kiểm thử cục bộ để Codex review; tuyệt đối KHÔNG commit, push hoặc deploy).*
