# Báo Cáo Sửa Chiều Cao & Hành Vi Cuộn Khung Chat Mobile (/watch-together)

## 1. Phạm Vi & Bối Cảnh (Scope & Context)
- **Repository**: `D:\dlowphim`
- **Mục tiêu**: Sửa tối thiểu sự cố co giãn chiều cao và hành vi cuộn giật của khung chat trên thiết bị di động trong route `/watch-together/room/[roomId]`.
- **Phạm vi bảo toàn & đóng băng (Frozen Scope)**:
  - Giữ nguyên 100% logic căn lề danh tính (Messenger Model) và WebKit Fullscreen đã được người dùng xác minh thành công trên thiết bị thật.
  - Tuyệt đối **không sửa** route `/watch`.
  - Không sửa backend, socket protocol, auth, player, hay quyền Host/Guest.
  - Không sửa layout Desktop ($\ge 1024$px), giữ nguyên cơ chế đồng bộ chiều cao `playerHeight` với trình phát video.
  - Không commit, không push, không deploy.

---

## 2. Nguyên Nhân Đã Xác Minh

1. **Sử dụng dynamic viewport height (`dvh`) kết hợp `transition-all`**:
   - Trước đây tại dòng 1816: `height: isDesktop ? `${playerHeight}px` : "clamp(360px, 52dvh, 460px)"` cùng class `transition-all duration-150`.
   - Trên trình duyệt di động (Safari iOS, Chrome Android), khi người dùng vuốt trang, thanh địa chỉ / thanh công cụ tự động ẩn hoặc hiện làm `dvh` thay đổi liên tục (ví dụ: viewport từ 700px $\rightarrow$ 800px $\rightarrow$ 700px).
   - Hiệu ứng `transition-all duration-150` khiến khung chat chạy hiệu ứng animate co giãn chiều cao theo từng pixel cuộn trang, tạo cảm giác giật và rung lắc giao diện.

2. **Auto-scroll ép cuộn vô điều kiện khi có tin nhắn mới**:
   - Trước đây tại dòng 950: `useEffect(() => { el.scrollTop = el.scrollHeight; }, [messages])`.
   - Mỗi khi danh sách `messages` thay đổi (bao gồm tin nhắn mới từ người khác hoặc thông báo hệ thống), giao diện cưỡng chế kéo `scrollTop` về đáy, khiến người dùng đang cuộn lên đọc tin nhắn cũ bị giật ngược xuống dưới cùng.

3. **Thiếu ràng buộc co giãn Flexbox (`min-h-0`, `shrink-0`, `overscroll-contain`)**:
   - Khung danh sách tin nhắn thiếu `min-h-0` và `overscroll-contain`, có thể gây tràn flex container hoặc cuộn dội lên trang cha (scroll bounce).
   - Header và ô nhập tin nhắn thiếu `shrink-0`, có nguy cơ bị ép nhỏ chiều cao khi bàn phím ảo xuất hiện.

---

## 3. Các Bản Sửa Đã Thực Hiện (Tối Thiểu & Chính Xác)

### 3.1. Ổn Định Chiều Cao Khung Chat Mobile & Loại Bỏ Transition Rung
* **Vị trí**: [frontend/src/app/watch-together/room/[roomId]/page.tsx (L1841-L1846)](file:///d:/dlowphim/frontend/src/app/watch-together/room/%5BroomId%5D/page.tsx#L1841-L1846)
* **Chi tiết**:
  - Gỡ bỏ `transition-all duration-150` khỏi khung chatbox.
  - Sử dụng chiều cao CSS cố định, ổn định theo breakpoint: `h-[400px] sm:h-[430px] md:h-[480px] lg:h-auto`.
  - Trên Desktop ($\ge 1024$px), tiếp tục giữ `style={isDesktop ? { height: `${playerHeight}px` } : undefined}` để khớp 1:1 với chiều cao player.

### 3.2. Triển Khai Cuộn Thông Minh (Smart Auto-Scroll)
* **Vị trí**:
  - [frontend/src/utils/watchTogetherFlow.ts (L72-L105)](file:///d:/dlowphim/frontend/src/utils/watchTogetherFlow.ts#L72-L105)
  - [frontend/src/app/watch-together/room/[roomId]/page.tsx (L220-L232, L962-L983)](file:///d:/dlowphim/frontend/src/app/watch-together/room/%5BroomId%5D/page.tsx#L962-L983)
* **Quy tắc**:
  - Khi nạp trang ban đầu (`isInitialLoad = true`) $\rightarrow$ Cuộn xuống đáy.
  - Khi chính người dùng hiện tại gửi tin (`isLatestMessageFromMe = true`) $\rightarrow$ Cuộn xuống đáy để xem tin mình vừa gửi.
  - Khi người dùng đang ở gần đáy (`distanceFromBottom <= 80px`) $\rightarrow$ Cuộn theo tin mới.
  - Khi người dùng đang cuộn lên trên đọc tin cũ (`distanceFromBottom > 80px`) $\rightarrow$ **Giữ nguyên vị trí đọc**, không kéo màn hình xuống.

### 3.3. Ràng Buộc Flexbox & Chống Tràn Trang
* **Vị trí**: [frontend/src/app/watch-together/room/[roomId]/page.tsx (L1848, L1875, L1978)](file:///d:/dlowphim/frontend/src/app/watch-together/room/%5BroomId%5D/page.tsx#L1875)
* **Chi tiết**:
  - Header: Thêm `shrink-0` để không bị ép nhỏ.
  - Danh sách tin nhắn: Thêm `min-h-0 overflow-y-auto overscroll-contain` kèm listener `onScroll={handleChatScroll}`.
  - Ô nhập tin nhắn & thông báo lỗi socket: Thêm `shrink-0` để luôn cố định ở chân khung chat, hiển thị rõ ràng ngay cả khi mở bàn phím ảo.

---

## 4. Số Đo & So Sánh Trước / Sau (Measurements & Evidence)

| Tiêu chí | Trước khi sửa (Baseline) | Sau khi sửa (Current) |
| :--- | :--- | :--- |
| **Chiều cao Chatbox Mobile (390px)** | Biến động từ 364px $\rightarrow$ 416px khi thanh địa chỉ ẩn/hiện (`52dvh`) | Cố định vững chắc **400px** (`h-[400px]`), không đổi khi vuốt |
| **Hiệu ứng chuyển động (Transition)** | `transition-all duration-150` (gây rung toàn khung) | Gỡ bỏ transition trên container, chuyển động mượt mà |
| **Hành vi khi đọc tin cũ** | Tin mới đến $\rightarrow$ Bị kéo tuột xuống đáy (`scrollTop = scrollHeight`) | Tin mới đến $\rightarrow$ **Giữ nguyên vị trí đọc** (`shouldAutoScroll = false`) |
| **Hành vi khi tự gửi tin** | Cuộn xuống đáy | Cuộn xuống đáy mượt mà (`isLatestMessageFromMe = true`) |
| **Chặn Bounce toàn trang** | Thiếu containment | Bổ sung `overscroll-contain` bên trong danh sách tin |
| **Đồng bộ Desktop ($\ge 1024$px)** | `height: ${playerHeight}px` | Giữ nguyên `height: ${playerHeight}px` |

---

## 5. Kết Quả Kiểm Thử Thực Tế

### 5.1. Frontend Unit Tests (`npm run test:watch`)
```text
> frontend@0.1.0 test:watch
> node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test src/utils/episodeUtils.test.ts src/utils/watchPlaybackFlow.test.ts src/utils/watchTogetherFlow.test.ts

✔ normalizes common PhimAPI and OPhim episode labels (1.15ms)
✔ matches an OPhim episode when the active episode came from PhimAPI (0.21ms)
✔ matches a PhimAPI episode when the active episode came from OPhim (0.15ms)
✔ uses a valid fallback when providers genuinely have different episodes (0.12ms)
✔ restores the same episode and time after PhimAPI fails over to OPhim (0.97ms)
✔ prefetches only near the end and selects the normalized next episode (0.26ms)
✔ honors a temporary global CDN block but allows it again after expiry (0.20ms)
✔ uses the stable HLS release and bounds media recovery with an audio codec swap (0.88ms)
✔ Messenger-style Chat Matrix A/B/C: aligns messages strictly by viewer identity, not room role (2.10ms)
✔ two users with identical display names ('Sad nhân') are never confused (0.14ms)
✔ Unified Identity Lifecycle: assert ID_render === ID_join === msg.senderId under storage errors and reconnect (0.18ms)
✔ handles storage failure or missing IDs gracefully without crashing (0.09ms)
✔ system messages are never marked as self messages (0.08ms)
✔ groups continuous messages from the same sender within 60 seconds (0.14ms)
✔ resolves correct fullscreen action across desktop container vs iOS Safari native video (0.10ms)
✔ isNearBottom: detects whether chat scroll is within bottom threshold (0.10ms)
✔ shouldAutoScrollChat: preserves reader position when reading old messages, follows new messages when near bottom or self-sent (0.09ms)
ℹ tests 17 | suites 0 | pass 17 | fail 0 | duration_ms 134.1ms
```
**Kết quả**: 17/17 tests PASSED (100%).

### 5.2. Frontend Typecheck (`npx tsc --noEmit`)
- **Kết quả**: 0 lỗi TypeScript (Exit code 0).

### 5.3. Frontend Production Build (`npm run build`)
- **Kết quả**: Biên dịch Next.js 14 thành công 21/21 routes tĩnh và động (Exit code 0).
- Route `/watch-together/room/[roomId]`: Size 19.5 kB, First Load JS 126 kB.

### 5.4. Git Whitespace Check (`git diff --check`)
- **Kết quả**: 0 lỗi whitespace.

---

## 6. Xác Nhận Bảo Toàn Hệ Thống
- Route `/watch`: Không bị thay đổi.
- Giao diện Desktop ($\ge 1024$px): Hoàn toàn giữ nguyên cơ chế đồng bộ chiều cao `playerHeight`.
- Danh tính chat & Messenger Model: Giữ nguyên logic `isSelfMessage` chuẩn hóa theo ID.
- Trình phát HLS & Safari Fullscreen: Giữ nguyên callback ref và native WebKit API đã được xác nhận hoạt động tốt trên thiết bị thật.
- Quyền Host/Guest & Socket: Duy trì chính xác 1 socket owner cho mỗi phòng.

---

## 7. Trạng Thái Xác Minh Thiết Bị Thực Tế
* **Logic cuộn thông minh & Unit Tests**: ✅ Đã kiểm chứng 100% qua test runner.
* **Biên dịch & Typecheck**: ✅ Đã kiểm chứng 100% không có lỗi.
* **Kiểm tra trên trình duyệt di động thật (Safari iOS / Chrome Android)**: ⚠️ **Chờ người dùng kiểm tra lại trên thiết bị thật** để cảm nhận độ êm ái khi vuốt thanh địa chỉ và đọc tin cũ.

---

## 8. Trạng Thái Git Hiện Tại
```text
 M frontend/src/app/watch-together/room/[roomId]/page.tsx
 M frontend/src/utils/watchTogetherFlow.test.ts
 M frontend/src/utils/watchTogetherFlow.ts
?? bao-cao-antigravity/watch-together-mobile-chat-scroll-stability.md
```
*(Dừng lại sau khi hoàn tất kiểm thử cục bộ để Codex review; tuyệt đối KHÔNG commit, push hoặc deploy).*
