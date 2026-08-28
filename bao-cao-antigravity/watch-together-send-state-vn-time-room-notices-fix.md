# Báo Cáo Sửa Đổi: Trạng Thái Gửi Chat, Giờ Việt Nam, Thông Báo Đóng Phòng Mobile & Modal Cảnh Báo Chọn Tập

## 1. Phạm Vi & Bối Cảnh (Scope & Baseline)
- **Repository**: `D:\dlowphim`
- **Mục tiêu sửa 4 hạng mục**:
  1. **Khắc phục kẹt trạng thái đang gửi chat khi thay phiên/socket**: Khi component teardown, đổi phòng hoặc reconnect tạo socket mới, giải phóng ngay `isSendingMessage = false` và tăng `sessionEpochRef` trước khi ngắt socket; vô hiệu hóa callback trễ của phiên cũ để socket mới luôn gửi được bình thường mà không bị kẹt nút gửi.
  2. **Thống nhất hiển thị giờ chat theo giờ Việt Nam (Asia/Ho_Chi_Minh - 24h HH:mm)**: Tạo pure helper `formatVietnamChatTime` ưu tiên lấy `createdAt` có múi giờ chuẩn, hiển thị nhất quán giữa realtime, tải lịch sử và reload, không phụ thuộc vào timezone của máy chủ production hay thiết bị người dùng.
  3. **Tối ưu UI thông báo đóng phòng / đưa khách về sảnh trên mobile (`/watch-together`)**: Sửa wrapper toast từ chiều rộng tự co hẹp 195px thành responsive `w-[calc(100%-2rem)] max-w-md`, flex text container `flex-1 min-w-0` chống co cụm chữ thành cột, nút đóng accessible và padding an toàn.
  4. **Thay native `alert()` bằng modal cảnh báo quyền khi khách bấm chọn tập**: Khách bấm nút tập phim chỉ mở modal "Không thể đổi tập" (Nút: "Đã hiểu"), không emit `change_episode`, không đổi highlight tập, không pause/seek hay ảnh hưởng đồng bộ phòng.
- **Phạm vi đóng băng (Frozen Scope)**:
  - Giữ nguyên 100% route `/watch`.
  - Giữ nguyên cơ chế Messenger chat alignment, `messageId` echo matching, WebKit Fullscreen iOS Safari, HLS player logic và socket protocol.
  - Không tạo thêm socket/listener/timer trùng lặp.
  - Không commit, không push, không deploy.

---

## 2. Danh Sách Tệp Thay Đổi (Files Changed)
- [frontend/src/utils/watchTogetherFlow.ts](file:///d:/dlowphim/frontend/src/utils/watchTogetherFlow.ts):
  - L47-L74: Thêm hàm `formatVietnamChatTime(createdAt, fallbackTime)` format chuẩn `vi-VN`, múi giờ `Asia/Ho_Chi_Minh`, 24h `HH:mm`.
- [frontend/src/app/watch-together/room/[roomId]/page.tsx](file:///d:/dlowphim/frontend/src/app/watch-together/room/%5BroomId%5D/page.tsx):
  - L134-L135: Thêm state `cannotChangeEpisodeModal` và `lastFocusedEpisodeBtnRef`.
  - L455: Format lịch sử chat với `formatVietnamChatTime(m.createdAt, m.time)`.
  - L792: Format realtime socket message với `formatVietnamChatTime(msg.createdAt, msg.time)`.
  - L941-L946: Socket cleanup: tăng `sessionEpochRef.current += 1`, reset `sendTrackerRef` và gọi `setIsSendingMessage(false)` trước `socket.disconnect()`.
  - L2009: Render timestamp chat với `formatVietnamChatTime(msg.createdAt, msg.time)`.
  - L2074-L2080: Khi khách bấm tập phim, lưu focus element, mở `cannotChangeEpisodeModal` và return ngay.
  - L2099-L2140: Render modal accessible "Không thể đổi tập" (`role="dialog"`, `aria-modal="true"`, Escape key support, nút "Đã hiểu").
- [frontend/src/app/watch-together/page.tsx](file:///d:/dlowphim/frontend/src/app/watch-together/page.tsx):
  - L212-L230: Sửa wrapper toast thông báo đóng phòng: `w-[calc(100%-2rem)] max-w-md`, `flex-1 min-w-0 text-left`, `leading-normal mt-0.5 break-words`, nút đóng `p-1.5 rounded-lg` với `aria-label="Đóng thông báo"`.
- [frontend/src/utils/watchTogetherFlow.test.ts](file:///d:/dlowphim/frontend/src/utils/watchTogetherFlow.test.ts):
  - Thêm unit tests cho `formatVietnamChatTime` (UTC ban ngày, UTC qua đêm, fallback) và `Session Lifecycle Isolation` (cleanup giải phóng `isSendingMessage`, cô lập callback cũ).

---

## 3. Chi Tiết Nguyên Nhân & Cách Khắc Phục

### Hạng mục 1: Sửa Trạng Thái Gửi Bị Kẹt Khi Thay Phiên / Reconnect Socket
* **Nguyên nhân**:
  - Khi người dùng bấm gửi tin nhắn, `isSendingMessage` đặt thành `true`.
  - Nếu xảy ra cleanup (đổi phòng, đổi user, reconnect tạo socket mới): `sessionEpochRef` tăng lên, nhưng `isSendingMessage` không được reset về `false`.
  - Khi timeout hoặc ACK cũ phản hồi về, guard `if (sessionEpochRef.current !== sendEpoch) return;` bỏ qua callback, khiến `isSendingMessage` mãi mãi bằng `true`, nút gửi bị khóa và chặn tất cả các lần gửi tiếp theo của phiên mới.
* **Cách sửa**:
  - Trong socket cleanup effect (`frontend/src/app/watch-together/room/[roomId]/page.tsx` L941-L946):
    - Tăng `sessionEpochRef.current += 1`.
    - Tạo tracker mới `sendTrackerRef.current = createSendTrackerState(...)`.
    - Gọi `setIsSendingMessage(false)` để mở khóa trạng thái gửi ngay khi phiên cũ kết thúc.
    - Đặt các thao tác này **trước** `socket.disconnect()` để bất kỳ callback đồng bộ nào do `disconnect()` kích hoạt cũng bị vô hiệu hóa an toàn bởi epoch mismatch.
  - Bản nháp `messageInput` được giữ nguyên khi gửi lỗi hoặc đổi phiên; không tự gửi lại gây duplicate.

### Hạng mục 2: Thống Nhất Giờ Chat Theo Giờ Việt Nam (Asia/Ho_Chi_Minh)
* **Nguyên nhân**:
  - Server gateway (`rooms.gateway.ts`) dùng `toLocaleTimeString()` không chỉ định timezone, phụ thuộc vào timezone của server hosting.
  - History và realtime client trước đây format hoặc lấy chuỗi không đồng nhất, dẫn đến việc cùng 1 tin nhắn hiển thị giờ khác nhau giữa lúc nhận realtime và lúc reload trang.
* **Cách sửa**:
  - Viết pure helper `formatVietnamChatTime` (`frontend/src/utils/watchTogetherFlow.ts` L47-L74):
    ```typescript
    export function formatVietnamChatTime(
      createdAt?: string | number | Date | null,
      fallbackTime?: string,
    ): string {
      if (createdAt) {
        const date = new Date(createdAt);
        if (!Number.isNaN(date.getTime())) {
          return date.toLocaleTimeString("vi-VN", {
            timeZone: "Asia/Ho_Chi_Minh",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          });
        }
      }
      if (fallbackTime && typeof fallbackTime === "string") return fallbackTime;
      return "";
    }
    ```
  - Áp dụng thống nhất cho cả:
    1. Lịch sử chat tải từ API (`m.createdAt`).
    2. Socket realtime message (`msg.createdAt` / `msg.time`).
    3. Trực tiếp tại vị trí render bubble (`msg.time`).
  - **Kết quả**:
    - `2026-08-28T03:42:00.000Z` $\rightarrow$ `10:42` (24h format).
    - `2026-08-27T17:05:00.000Z` $\rightarrow$ `00:05` (ngày 28/08).
    - Realtime $\rightarrow$ reload lịch sử hiển thị trùng khớp 100% bất kể server hay máy khách ở múi giờ nào.

### Hạng mục 3: UI Thông Báo Đóng Phòng Trên Mobile (`/watch-together`)
* **Nguyên nhân**:
  - Wrapper trước đây dùng `fixed top-24 left-1/2 -translate-x-1/2` không có `width` cụ thể, flex container bị co cụm trên viewport 390px chỉ còn 195px chiều rộng, phần text chỉ còn ~60px khiến chữ bị ép thành cột hẹp dài.
* **Cách sửa**:
  - Wrapper ngoài: `fixed top-20 sm:top-24 left-1/2 -translate-x-1/2 z-[9999] w-[calc(100%-2rem)] max-w-md`.
  - Flex inner: `w-full px-4 sm:px-5 py-3 rounded-2xl border-l-4 border-l-pink-500`.
  - Text container: `flex-1 min-w-0 text-left`, tiêu đề `text-[10px] font-black text-pink-400 uppercase tracking-wider`, nội dung `text-xs text-zinc-200 font-bold leading-normal mt-0.5 break-words`.
  - Nút đóng: `p-1.5 rounded-lg text-zinc-400 hover:text-white shrink-0` kèm `aria-label="Đóng thông báo"`.
  - Phân biệt rõ thông điệp:
    - Chủ phòng: "Bạn đã đóng phòng thành công. Mọi người đã được đưa về sảnh."
    - Khách: "Trưởng phòng đã đóng phòng. Bạn đã được đưa về sảnh xem chung."

### Hạng mục 4: Modal Cảnh Báo Quyền Khi Khách Bấm Chọn Tập Phim
* **Nguyên nhân**:
  - Trước đây sử dụng hàm `alert(...)` mặc định của trình duyệt gây gián đoạn trải nghiệm người dùng và không tương thích tốt trên mobile/PWA.
* **Cách sửa**:
  - Thay thế hoàn toàn `alert()` bằng custom in-app modal:
    - Tiêu đề: **"Không thể đổi tập"** (Cảnh báo quyền).
    - Nội dung: **"Chỉ chủ phòng mới được đổi tập phim. Bạn đang xem đồng bộ theo chủ phòng."**
    - Nút duy nhất: **"Đã hiểu"** (Không có nút tiếp tục hay xác nhận đổi tập).
  - **Hành vi**:
    - Khách bấm tập phim: Chỉ mở modal, return ngay lập tức.
    - KHÔNG emit `change_episode`.
    - KHÔNG gọi `setActiveEpisodeIndex` hay thay đổi highlight tập.
    - KHÔNG thay đổi video stream, pause/seek hay ảnh hưởng đồng bộ phòng.
    - Hỗ trợ phím Escape để đóng modal và tự động trả lại focus cho nút tập phim vừa bấm (`lastFocusedEpisodeBtnRef`).
    - Backend guard (`rooms.gateway.ts` L895-L898) tiếp tục bảo vệ, từ chối mọi socket emit trái phép từ khách.

---

## 4. Kết Quả Xác Minh & Bằng Chứng (Verification Evidence)

### 4.1. Unit Test Runner (`npm run test:watch`)
```text
> frontend@0.1.0 test:watch
> node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test src/utils/episodeUtils.test.ts src/utils/watchPlaybackFlow.test.ts src/utils/watchTogetherFlow.test.ts

✔ normalizes common PhimAPI and OPhim episode labels (1.13ms)
✔ matches an OPhim episode when the active episode came from PhimAPI (0.19ms)
✔ matches a PhimAPI episode when the active episode came from OPhim (0.11ms)
✔ uses a valid fallback when providers genuinely have different episodes (0.08ms)
✔ restores the same episode and time after PhimAPI fails over to OPhim (0.86ms)
✔ prefetches only near the end and selects the normalized next episode (0.18ms)
✔ honors a temporary global CDN block but allows it again after expiry (0.92ms)
✔ uses the stable HLS release and bounds media recovery with an audio codec swap (0.59ms)
✔ Messenger-style Chat Matrix A/B/C: aligns messages strictly by viewer identity, not room role (1.45ms)
✔ two users with identical display names ('Sad nhân') are never confused (0.18ms)
✔ Unified Identity Lifecycle: assert ID_render === ID_join === msg.senderId under storage errors and reconnect (0.19ms)
✔ handles storage failure or missing IDs gracefully without crashing (0.09ms)
✔ system messages are never marked as self messages (0.12ms)
✔ groups continuous messages from the same sender within 60 seconds (0.17ms)
✔ resolves correct fullscreen action across desktop container vs iOS Safari native video (0.11ms)
✔ isNearBottom: detects whether chat scroll is within bottom threshold (0.09ms)
✔ shouldAutoScrollChat: preserves reader position when reading old messages, ignores user object re-renders without new messages (0.13ms)
✔ evaluateBatchAutoScroll MessageId & Session Lifecycle: MessageId matching, out-of-order ACK/Echo, session cleanup, same-account different devices (0.47ms)
✔ formatVietnamChatTime: formats time strictly in Asia/Ho_Chi_Minh 24h format (HH:mm) regardless of environment (11.31ms)
✔ Session Lifecycle Isolation: Session teardown resets isSendingMessage and prevents stale callbacks from modifying new session (0.20ms)
ℹ tests 20 | suites 0 | pass 20 | fail 0 | cancelled 0 | skipped 0 | todo 0 | duration_ms 115.36ms
```
**Kết quả**: **20/20 tests PASSED** (100%).

### 4.2. TypeScript Typecheck (`npx tsc --noEmit`)
- **Kết quả**: 0 lỗi TypeScript (Exit code 0).

### 4.3. Next.js Production Build (`npm run build`)
- **Kết quả**: 21/21 routes biên dịch thành công (Exit code 0).
- `/watch-together`: Size 7.25 kB, First Load JS 126 kB.
- `/watch-together/room/[roomId]`: Size 20.7 kB, First Load JS 127 kB.

### 4.4. Kiểm Tra Whitespace (`git diff --check`)
- **Kết quả**: 0 lỗi format / whitespace.

---

## 5. Quyền Sở Hữu Dữ Liệu & Socket (Ownership Verification)
- Không tạo thêm socket instance, timer hay listener trùng lặp.
- Backend gateway tiếp tục là thẩm quyền xác thực duy nhất cho quyền đổi tập phim (`isHost`).
- Toàn bộ cơ chế timezone formatting được xử lý thuần túy tại frontend presentation layer dựa trên timestamp UTC chuẩn (`createdAt`), không can thiệp migration cơ sở dữ liệu hay sửa giờ backend.

---

## 6. Ảnh Hưởng Trên Desktop & Rủi Ro Còn Lại (Desktop Impact & Remaining Risks)
- **Desktop**:
  - Toast thông báo đóng phòng trên desktop có `max-w-md` căn giữa màn hình, giữ nguyên giao diện đẹp mắt.
  - Danh sách tập phim và modal trên desktop hiển thị chuẩn mực, hỗ trợ phím Escape và focus ring.
- **Rủi ro còn lại**:
  - Cần người dùng trải nghiệm thực tế trên các thiết bị mobile/browser khác nhau (iOS Safari, Android Chrome) để kiểm tra tương tác cảm ứng thực tế.
  - Timezone của server hosting production chưa được can thiệp trực tiếp từ backend (frontend đã tự xử lý chuẩn 100% qua `formatVietnamChatTime`).

---

## 7. Trạng Thái Git Hiện Tại
```text
 M frontend/src/app/watch-together/create/[slug]/page.tsx
 M frontend/src/app/watch-together/page.tsx
 M frontend/src/app/watch-together/room/[roomId]/page.tsx
 M frontend/src/utils/watchTogetherFlow.test.ts
 M frontend/src/utils/watchTogetherFlow.ts
```
*(Dừng lại để Codex review; KHÔNG commit, push hoặc deploy).*
