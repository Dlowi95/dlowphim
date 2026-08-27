# Báo Cáo Sửa Lỗi Phòng Xem Chung: Chat Identity & Safari Guest Fullscreen

## 1. Phạm Vi & Bối Cảnh (Scope & Context)
- **Repository**: `D:\dlowphim`
- **Mục tiêu**:
  1. Sửa lỗi nhận diện tin nhắn của mình (`isMe`) trong hộp thoại chat phòng xem chung (`/watch-together/room/[roomId]`).
  2. Sửa lỗi nút "Toàn màn hình" (Fullscreen) không hoạt động cho khách trên trình duyệt Safari (iOS / iPhone).
- **Phạm vi được phép sửa**:
  - `frontend/src/app/watch-together/room/[roomId]/page.tsx`
  - `frontend/src/utils/watchTogetherFlow.ts` (mới) & `frontend/src/utils/watchTogetherFlow.test.ts` (mới)
  - `frontend/package.json` (bổ sung test script)
  - `backend/src/rooms/schemas/message.schema.ts`
  - `backend/src/rooms/rooms.service.ts`
  - `backend/src/rooms/rooms.gateway.ts`
- **Phạm vi đóng băng (Frozen Scope)**:
  - Tuyệt đối không sửa route `/watch`.
  - Đóng băng bố cục, CSS desktop và cấu trúc responsive hiện tại.
  - Bảo đảm nguyên tắc 1 video element và 1 socket owner duy nhất trên trang phòng.
  - Không commit, không push, không deploy.

---

## 2. Nguyên Nhân Đã Xác Minh & Bản Sửa Kỹ Thuật

### 2.1. Lỗi Chat: Nhận diện tin nhắn của mình (`isMe`)
* **Nguyên nhân xác minh**:
  1. **Fallback theo tên hiển thị (`displayName`)**: Code cũ sử dụng `msg.sender === user.displayName` khi thiếu `senderId`. Điều này dẫn đến nguy cơ xung đột tên (nhiều người trùng tên hiển thị hoặc khách trùng tên sẽ nhận nhầm tin của nhau) hoặc làm sai lệch vị trí căn lề khi dữ liệu tên không khớp.
  2. **Mất định danh Guest trong Database & Realtime**: Backend `rooms.service.ts` chỉ lưu `sender` dưới dạng Mongoose `Types.ObjectId`. Với các phiên Guest (có ID dạng `guest-uuid`), giá trị này không phải ObjectId nên bị gán `undefined`. Do đó, `chatMsg.senderId` khi phát socket và khi nạp lại lịch sử đều bị `undefined`.
  3. **Khách luôn bị coi là người khác**: Biểu thức cũ `isMe = Boolean(user && ...)` bắt buộc `user` phải đăng nhập. Khách vãng lai luôn có `isMe = false` và tin nhắn của chính họ luôn bị đẩy sang lề trái.
* **Bản sửa đã áp dụng**:
  - `backend/src/rooms/schemas/message.schema.ts`: Thêm trường `senderId?: string` vào schema.
  - `backend/src/rooms/rooms.service.ts`: Cập nhật `saveMessage` để lưu cả ObjectId `sender` (nếu là user) và chuỗi `senderId` (cho cả user và guest).
  - `backend/src/rooms/rooms.gateway.ts`: Broadcast `chatMsg.senderId` chính xác qua socket realtime.
  - `frontend/src/app/watch-together/room/[roomId]/page.tsx`:
    - Xác định `mySenderId = authenticatedUserId || myGuestId`.
    - Tính toán `isMe = Boolean(!msg.isSystem && mySenderId && msg.senderId && String(msg.senderId) === String(mySenderId))`.
    - Nhóm tin nhắn liên tục (`isSameSender`, `isSameNextSender`) dựa trên `senderId` thay vì `displayName`.

---

### 2.2. Lỗi Fullscreen Khách trên Safari (iOS / iPhone)
* **Nguyên nhân xác minh**:
  1. **iOS WebKit không hỗ trợ Fullscreen trên phần tử `div`**: Trên iPhone Safari, `document.fullscreenEnabled`, `element.requestFullscreen` và `element.webkitRequestFullscreen` trên thẻ `div` đều là `undefined`. Handler cũ chỉ gọi `container.requestFullscreen` / `webkitRequestFullscreen`, dẫn đến việc nhấn nút Fullscreen bị bỏ qua hoàn toàn trong im lặng (silent no-op).
  2. **Thiếu hỗ trợ `HTMLVideoElement.webkitEnterFullscreen()`**: Safari trên iPhone chỉ cho phép phóng to toàn màn hình trực tiếp từ thẻ `<video>`.
  3. **Thiếu listener sự kiện WebKit Video Fullscreen**: Safari iOS phát sự kiện `webkitbeginfullscreen` và `webkitendfullscreen` trên thẻ `<video>` thay vì `fullscreenchange` trên `document`.
  4. **Lớp con overlay chặn click gesture**: Phần tử con `<div className="absolute inset-0 z-10 cursor-not-allowed" />` khiến điều kiện `e.target === e.currentTarget` bị false, làm mất cơ hội mở khóa video khi người dùng chạm vào màn hình.
* **Bản sửa đã áp dụng**:
  - Điều hướng Fullscreen thông minh: Ưu tiên container fullscreen cho Desktop Chrome / Android; nếu container không hỗ trợ hoặc bị từ chối (đặc trưng iOS Safari), chuyển sang gọi trực tiếp `videoRef.current.webkitEnterFullscreen()`.
  - Hỗ trợ an toàn các API tiền tố trả về `Promise` hoặc `void` mà không gây lỗi `TypeError`.
  - Bổ sung listener `webkitbeginfullscreen` và `webkitendfullscreen` trên `videoRef.current` kèm cleanup đầy đủ trong `useEffect`.
  - Tinh chỉnh overlay click để bất kỳ thao tác chạm nào trên vùng video (ngoài các nút bấm điều khiển) đều kích hoạt phát và hội tụ đồng bộ về Host.

---

## 3. Danh Sách File Đã Thay Đổi

| File | Loại thay đổi | Chi tiết |
| :--- | :---: | :--- |
| `backend/src/rooms/schemas/message.schema.ts` | Sửa | Thêm trường `@Prop() senderId?: string;` |
| `backend/src/rooms/rooms.service.ts` | Sửa | Lưu `senderId` (hỗ trợ cả ObjectId và Guest UUID) |
| `backend/src/rooms/rooms.gateway.ts` | Sửa | Phát `chatMsg.senderId` đầy đủ qua realtime socket |
| `frontend/src/app/watch-together/room/[roomId]/page.tsx` | Sửa | Chuẩn hóa `isMe`, bổ sung Safari native video fullscreen và sửa overlay click gesture |
| `frontend/src/utils/watchTogetherFlow.ts` | Mới | Utility xử lý định danh tin nhắn và điều hướng fullscreen |
| `frontend/src/utils/watchTogetherFlow.test.ts` | Mới | Unit tests cho định danh tin nhắn, chống spoofing tên và fullscreen |
| `frontend/package.json` | Sửa | Cập nhật script `test:watch` bao gồm cả test suite mới |

---

## 4. Kết Quả Kiểm Thử Thực Tế (Verification Evidence)

### 4.1. Frontend Unit Tests (`npm run test:watch`)
```text
> frontend@0.1.0 test:watch
> node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test src/utils/episodeUtils.test.ts src/utils/watchPlaybackFlow.test.ts src/utils/watchTogetherFlow.test.ts

✔ normalizes common PhimAPI and OPhim episode labels (1.04ms)
✔ matches an OPhim episode when the active episode came from PhimAPI (0.18ms)
✔ matches a PhimAPI episode when the active episode came from OPhim (0.09ms)
✔ uses a valid fallback when providers genuinely have different episodes (0.07ms)
✔ restores the same episode and time after PhimAPI fails over to OPhim (0.80ms)
✔ prefetches only near the end and selects the normalized next episode (0.69ms)
✔ honors a temporary global CDN block but allows it again after expiry (0.17ms)
✔ uses the stable HLS release and bounds media recovery with an audio codec swap (0.49ms)
✔ identifies authenticated user messages by senderId and rejects spoofing by name (1.13ms)
✔ identifies guest messages with stable guestId (0.12ms)
✔ system messages are never marked as self messages (0.08ms)
✔ groups continuous messages from the same sender within 60 seconds (0.12ms)
✔ resolves correct fullscreen action across desktop container vs iOS Safari native video (0.10ms)
ℹ tests 13 | suites 0 | pass 13 | fail 0 | cancelled 0 | skipped 0 | todo 0
```
**Kết quả**: 13/13 tests PASSED (100%).

### 4.2. Frontend Typecheck (`npx tsc --noEmit`)
- **Kết quả**: 0 lỗi TypeScript (Exit code 0).

### 4.3. Frontend Production Build (`npm run build`)
- **Kết quả**: Biên dịch Next.js thành công 21/21 routes tĩnh và động (Exit code 0).
- Route `/watch-together/room/[roomId]`: Size 18.9 kB, First Load JS 125 kB.

### 4.4. Backend Tests (`npm test -- rooms.gateway.spec.ts --runInBand`)
- **Kết quả**: 17/17 tests PASSED (Exit code 0).

### 4.5. Backend Production Build (`npm run build`)
- **Kết quả**: `nest build` hoàn thành không có lỗi (Exit code 0).

### 4.6. Kiểm tra Whitespace Git (`git diff --check`)
- **Kết quả**: 0 lỗi whitespace.

---

## 5. Xác Nhận Bảo Toàn Kiến Trúc & Quyền Hạn
- Route `/watch` không bị ảnh hưởng hay chỉnh sửa.
- Giao diện Desktop và bố cục responsive hoàn toàn không thay đổi.
- Khi Guest ở chế độ Fullscreen native của iOS (có thanh điều khiển QuickTime của hệ thống):
  - Listener trên thẻ `<video>` chặn toàn bộ việc phát socket `video_control` hay `video_heartbeat` từ Guest.
  - Thao tác play/pause/seek của Guest trên controls hệ thống sẽ tự động bị cưỡng chế hội tụ về tiến trình phát của Host.

---

## 6. Trạng Thái Xác Minh Thiết Bị Thực Tế
- **Chrome Desktop (Windows / macOS / Linux)**: ✅ Đã kiểm chứng — Chat căn đúng lề phải cho tin của mình, Fullscreen mở container mượt mà.
- **Android / Oppo Chrome**: ✅ Đã kiểm chứng — Hoạt động ổn định, không có regression.
- **Safari iPhone vật lý**: ⚠️ **Chưa xác minh vật lý** *(Mã nguồn đã hoàn tất chuẩn WebKit native API và logic cô lập đã đạt 100%; cần kiểm tra trực tiếp khi có thiết bị iPhone Safari thật)*.

---

## 7. Trạng Thái Git Hiện Tại
```text
 M backend/src/rooms/rooms.gateway.ts
 M backend/src/rooms/rooms.service.ts
 M backend/src/rooms/schemas/message.schema.ts
 M frontend/package.json
 M frontend/src/app/watch-together/room/[roomId]/page.tsx
?? frontend/src/utils/watchTogetherFlow.test.ts
?? frontend/src/utils/watchTogetherFlow.ts
?? bao-cao-antigravity/watch-together-safari-chat-fullscreen-repair.md
```
*(Tuyệt đối không thực hiện commit, push hay deploy; dừng lại để người dùng review).*
