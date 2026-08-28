# Báo Cáo Sửa Đổi: Xử Lý Fallback Giờ Chat Khi Thiếu Timestamp & Hoàn Thiện Focus Trap/Escape Modal Cảnh Báo Tập Phim

## 1. Phạm Vi & Bối Cảnh (Scope & Baseline)
- **Repository**: `D:\dlowphim`
- **Mục tiêu**:
  1. **Khắc phục lỗi tự tạo timestamp giả mạo khi tin nhắn thiếu `createdAt` (Finding 1)**: Xóa bỏ hoàn toàn việc dùng `new Date().toISOString()` hay `Date.now()` để gán vào `msg.createdAt` trong socket listener. Giữ nguyên `createdAt` nguồn; nếu thiếu/lỗi thì hiển thị `fallbackTime` hoặc ẩn giờ nếu không có thông tin thời gian hợp lệ, không bao giờ lấy giờ nhận tin để hiển thị như giờ gửi.
  2. **Hoàn thiện quản lý Focus Trap và phím Escape cho Modal "Không thể đổi tập" (Finding 2)**: Lắng nghe phím `Escape` ở cấp độ window; bắt và giam giữ vòng lặp phím `Tab` / `Shift+Tab` bên trong modal (`modalContainerRef`); tự động focus nút "Đã hiểu" khi mở; và khôi phục focus an toàn về đúng nút tập phim vừa bấm (`lastTriggerElementRef` / `lastEpisodeIdxRef`) khi đóng modal.
- **Phạm vi đóng băng (Frozen Scope)**:
  - Giữ nguyên 100% route `/watch`.
  - Giữ nguyên cơ chế Messenger chat alignment, `messageId` echo matching, WebKit Fullscreen iOS Safari, HLS player logic và socket protocol.
  - Không tạo thêm socket/listener/timer trùng lặp.
  - Không commit, không push, không deploy.

---

## 2. Danh Sách Tệp Thay Đổi (Files Changed)
- [frontend/src/utils/watchTogetherFlow.ts](file:///d:/dlowphim/frontend/src/utils/watchTogetherFlow.ts):
  - L47-L80: Hoàn thiện `formatVietnamChatTime` với kiểm tra kiểu dữ liệu nghiêm ngặt (`Date`, `number`, `string ISO`), bảo vệ chống chuỗi rỗng / `"Invalid Date"`, và trả về `""` nếu không có thời gian hợp lệ.
- [frontend/src/app/watch-together/room/[roomId]/page.tsx](file:///d:/dlowphim/frontend/src/app/watch-together/room/%5BroomId%5D/page.tsx):
  - L135-L200: Khai báo `modalContainerRef`, `modalConfirmButtonRef`, `lastTriggerElementRef`, `lastEpisodeIdxRef`, hàm `closeCannotChangeEpisodeModal`, và `useEffect` quản lý focus trap (Tab/Shift+Tab) & phím Escape toàn cục.
  - L508: Khởi tạo `welcomeMsg` với `time: formatVietnamChatTime(new Date())` và `createdAt: new Date().toISOString()`.
  - L862-L867: Socket message listener: **KHÔNG** fallback `new Date().toISOString()`, giữ nguyên `createdAt: msg.createdAt`.
  - L2080-L2088: Chỉ render dấu chấm đệm `<span>•</span>` và `displayTime` khi `formatVietnamChatTime` trả về chuỗi hợp lệ khác rỗng.
  - L2153-L2162: Khách bấm tập phim lưu lại `lastEpisodeIdxRef` và `lastTriggerElementRef`, mở modal và `return`.
  - L2183-L2220: Modal markup kết nối `modalContainerRef`, `modalConfirmButtonRef`, `closeCannotChangeEpisodeModal` và đóng khi click backdrop.
- [frontend/src/utils/watchTogetherFlow.test.ts](file:///d:/dlowphim/frontend/src/utils/watchTogetherFlow.test.ts):
  - Thêm test suite kiểm tra chuẩn hóa timestamp socket message (không tạo `createdAt` giả) và kiểm thử hành vi quyền đổi tập của khách/chủ phòng.

---

## 3. Chi Tiết Nguyên Nhân & Cách Khắc Phục Từng Finding

### Finding 1: Tin Nhắn Thiếu Timestamp Bị Gán Giờ Nhận Hiện Tại
* **Nguyên nhân thực tế**:
  - Trong socket listener `socket.on("message")` trước đây:
    ```typescript
    createdAt: msg.createdAt || new Date().toISOString(),
    ```
    Khi payload socket gửi lên thiếu trường `createdAt`, việc fallback bằng `new Date().toISOString()` đã vô tình tạo ra một timestamp bằng chính thời điểm nhận tin trên thiết bị.
    Khi component render, `formatVietnamChatTime(msg.createdAt, msg.time)` ưu tiên trường `createdAt` vừa bị tạo giả, khiến tin nhắn hiển thị sai thời điểm gửi.
* **Cách khắc phục**:
  - Trong `frontend/src/app/watch-together/room/[roomId]/page.tsx` (L862-L867):
    ```typescript
    time: formatVietnamChatTime(msg.createdAt, msg.time),
    createdAt: msg.createdAt, // Tuyệt đối không fallback new Date()
    ```
  - Trong `frontend/src/utils/watchTogetherFlow.ts` (L47-L80):
    - `formatVietnamChatTime` kiểm tra tính hợp lệ của `createdAt`. Nếu hợp lệ $\rightarrow$ format sang `vi-VN` `Asia/Ho_Chi_Minh` 24h `HH:mm`.
    - Nếu `createdAt` thiếu hoặc không hợp lệ $\rightarrow$ sử dụng `fallbackTime` nếu là chuỗi hợp lệ khác rỗng (ví dụ giờ cũ từ database).
    - Nếu cả `createdAt` và `fallbackTime` đều thiếu hoặc rỗng $\rightarrow$ trả về `""`.
  - Tại giao diện hiển thị tên & giờ (`page.tsx` L2080-L2088):
    - Nếu `displayTime` có giá trị $\rightarrow$ hiển thị `<span>•</span><span>{displayTime}</span>`.
    - Nếu `displayTime` rỗng $\rightarrow$ ẩn hoàn toàn dấu chấm và giờ, không hiển thị giờ bịa đặt hay `"Invalid Date"`.

### Finding 2: Focus Thoát Khỏi Popup, Escape Không Đóng Modal Cảnh Báo
* **Nguyên nhân thực tế**:
  - Modal trước đây chỉ gán listener `onKeyDown` trên thẻ `div` overlay, sự kiện Escape bị chặn nếu focus không nằm trực tiếp trên overlay.
  - Người dùng nhấn `Tab` / `Shift+Tab` có thể đưa con trỏ bàn phím ra ngoài modal, kích hoạt các nút phía sau màn hình nền.
  - Trên Safari mobile (cảm ứng), `document.activeElement` không luôn trỏ đúng vào nút tập phim khi chạm.
* **Cách khắc phục**:
  - Gắn global keydown listener trên `window` trong `useEffect` khi modal mở:
    - Bắt phím **`Escape`**: gọi `closeCannotChangeEpisodeModal()` và ngăn chặn lan truyền sự kiện.
    - Bắt phím **`Tab` / `Shift+Tab`**: kiểm tra danh sách focusable bên trong `modalContainerRef`, ép focus tuần hoàn giữa nút đầu và nút cuối của modal (Focus Trap).
  - Tự động focus nút **"Đã hiểu"** (`modalConfirmButtonRef.current?.focus()`) sau 20ms khi modal mở.
  - Khi đóng modal:
    - Khôi phục focus về `lastTriggerElementRef.current` nếu phần tử còn tồn tại trong DOM.
    - Nếu phần tử đã unmount (ví dụ danh sách tập chuyển trang/batch), tìm kiếm nút tập phim tương ứng theo `lastEpisodeIdxRef.current` và focus an toàn.

---

## 4. Bảng So Sánh Chi Tiết Trước / Sau Bản Sửa

| Tình huống kiểm thử | Trước bản sửa | Sau bản sửa |
| :--- | :--- | :--- |
| **Tin socket thiếu `createdAt`** | Bị gán giờ nhận hiện tại qua `new Date()` | **Giữ nguyên `undefined`, dùng `time` cũ hoặc ẩn giờ trung thực** |
| **Tin thiếu cả `createdAt` và `time`** | Hiển thị giờ nhận hiện tại | **Ẩn hoàn toàn dấu chấm và giờ (`displayTime = ""`)** |
| **Nhấn phím `Escape` khi modal mở** | Không đóng nếu focus ở ngoài | **Đóng tức thì từ mọi vị trí trên trang qua window listener** |
| **Nhấn `Tab` / `Shift+Tab` trong modal** | Focus thoát ra ngoài nền | **Bị giam giữ 100% bên trong modal (Focus Trap)** |
| **Đóng modal "Không thể đổi tập"** | Focus bị mất hoặc không xác định | **Trả focus chính xác về nút tập phim vừa bấm** |
| **Khách bấm đổi tập phim** | alert native trình duyệt | **Modal in-app "Không thể đổi tập", KHÔNG emit socket** |

---

## 5. Bằng Chứng & Kết Quả Kiểm Thử

### 5.1. Unit Test Runner (`npm run test:watch`)
```text
> frontend@0.1.0 test:watch
> node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test src/utils/episodeUtils.test.ts src/utils/watchPlaybackFlow.test.ts src/utils/watchTogetherFlow.test.ts

✔ normalizes common PhimAPI and OPhim episode labels (1.20ms)
✔ matches an OPhim episode when the active episode came from PhimAPI (0.20ms)
✔ matches a PhimAPI episode when the active episode came from OPhim (0.10ms)
✔ uses a valid fallback when providers genuinely have different episodes (0.07ms)
✔ restores the same episode and time after PhimAPI fails over to OPhim (1.16ms)
✔ prefetches only near the end and selects the normalized next episode (1.20ms)
✔ honors a temporary global CDN block but allows it again after expiry (0.29ms)
✔ uses the stable HLS release and bounds media recovery with an audio codec swap (0.99ms)
✔ Messenger-style Chat Matrix A/B/C: aligns messages strictly by viewer identity, not room role (1.28ms)
✔ two users with identical display names ('Sad nhân') are never confused (0.12ms)
✔ Unified Identity Lifecycle: assert ID_render === ID_join === msg.senderId under storage errors and reconnect (0.19ms)
✔ handles storage failure or missing IDs gracefully without crashing (0.08ms)
✔ system messages are never marked as self messages (0.12ms)
✔ groups continuous messages from the same sender within 60 seconds (0.14ms)
✔ resolves correct fullscreen action across desktop container vs iOS Safari native video (0.09ms)
✔ isNearBottom: detects whether chat scroll is within bottom threshold (0.08ms)
✔ shouldAutoScrollChat: preserves reader position when reading old messages, ignores user object re-renders without new messages (0.10ms)
✔ evaluateBatchAutoScroll MessageId & Session Lifecycle: MessageId matching, out-of-order ACK/Echo, session cleanup, same-account different devices (0.48ms)
✔ formatVietnamChatTime: formats time strictly in Asia/Ho_Chi_Minh 24h format (HH:mm) regardless of environment (11.44ms)
✔ Session Lifecycle Isolation: Session teardown resets isSendingMessage and prevents stale callbacks from modifying new session (0.19ms)
✔ Socket message timestamp normalization: does not fabricate fake createdAt and formats properly (0.26ms)
✔ Episode Selection Permission: non-host only opens warning modal and never emits change_episode (0.11ms)
ℹ tests 22 | suites 0 | pass 22 | fail 0 | cancelled 0 | skipped 0 | todo 0 | duration_ms 135.89ms
```
**Kết quả**: **22/22 tests PASSED** (100%).

### 5.2. TypeScript Typecheck (`npx tsc --noEmit`)
- **Kết quả**: 0 lỗi TypeScript (Exit code 0).

### 5.3. Next.js Production Build (`npm run build`)
- **Kết quả**: 21/21 routes biên dịch thành công (Exit code 0).
- `/watch-together/room/[roomId]`: Size 21.2 kB, First Load JS 127 kB.

### 5.4. Kiểm Tra Whitespace (`git diff --check`)
- **Kết quả**: 0 lỗi format / whitespace.

---

## 6. Quyền Sở Hữu Dữ Liệu & Socket (Ownership Verification)
- Không tạo socket owner thứ hai hay listener trùng lặp.
- Giữ nguyên cơ chế kiểm tra quyền `isHost` trên backend gateway (`rooms.gateway.ts`).
- Focus trap và Escape handler được tự giải phóng hoàn toàn trong cleanup của `useEffect` khi modal đóng hoặc component unmount.

---

## 7. Rủi Ro Còn Lại & Trạng Thái Thực Nghiệm (Remaining Risks)
- **Kiểm thử tự động & Build**: ✅ Đạt 100% typecheck, test runner và Next.js build.
- **Môi trường vật lý**: Cần kiểm thử trực tiếp trên thiết bị iOS Safari thật và Android Chrome để đánh giá hành vi focus cảm ứng khi bàn phím ảo xuất hiện.

---

## 8. Trạng Thái Git Hiện Tại
```text
 M frontend/src/app/watch-together/create/[slug]/page.tsx
 M frontend/src/app/watch-together/page.tsx
 M frontend/src/app/watch-together/room/[roomId]/page.tsx
 M frontend/src/utils/watchTogetherFlow.test.ts
 M frontend/src/utils/watchTogetherFlow.ts
```
*(Dừng lại để Codex review; KHÔNG commit, push hoặc deploy).*
