# Báo Cáo Sửa Đổi: MessageId Echo Matching, Session Cleanup Lifecycle & Mobile Scrollable Overflow Fix

## 1. Phạm Vi & Bối Cảnh (Scope & Baseline)
- **Repository**: `D:\dlowphim`
- **Mục tiêu**:
  1. **Khắc phục triệt để việc nhận nhầm Echo bằng `messageId` (Finding 1)**: Sử dụng chính xác `messageId` do server trả về trong ACK callback `{ ok: true, messageId }` để đối chiếu với `message.id`. Loại bỏ hoàn toàn việc suy đoán theo `displayName`, `senderId`, `text` hay `FIFO`. Không cuộn hoặc tiêu thụ nhầm khi cùng tài khoản gửi từ thiết bị khác.
  2. **Dọn dẹp vòng đời phiên và vô hiệu hóa callback trễ (Finding 2)**: Quản lý `sessionEpochRef` và `sessionId` gắn liền với phiên socket/room. Khi đổi phòng, đổi danh tính, unmount hoặc reconnect tạo socket mới, phiên cũ được hủy an toàn, callback trễ của phiên cũ không làm biến đổi state/tracker của phiên mới.
  3. **Khắc phục lỗi kẹt cuộn và cắt phần đầu màn chờ mobile (Finding 3)**: Xóa bỏ `justify-center` ở container scrollable mobile ($< 768$px) và thay bằng `md:justify-center`, kết hợp `my-auto py-4 md:py-0 shrink-0` ở phần tử con để bảo đảm tại root font 20px / 32px và viewport 390px, người dùng luôn truy cập được 100% nội dung từ đỉnh ($y \ge 0$) đến nút bấm ở đáy mà không bị âm toạ độ.
- **Phạm vi đóng băng (Frozen Scope)**:
  - Giữ nguyên 100% route `/watch`.
  - Giữ nguyên cơ chế danh tính Messenger Model, WebKit Fullscreen, HLS player logic, socket protocol và backend authorization.
  - Không tạo thêm player, socket, API owner hay timer thứ hai.
  - Không commit, không push, không deploy.

---

## 2. Danh Sách Tệp Thay Đổi (Files Changed)
- [frontend/src/utils/watchTogetherFlow.ts](file:///d:/dlowphim/frontend/src/utils/watchTogetherFlow.ts):
  - Triển khai máy trạng thái `SendTrackerState` (`recordLocalSendAttempt`, `confirmLocalSendAck`, `cancelLocalSendAttempt`, `evaluateBatchAutoScroll`).
- [frontend/src/app/watch-together/room/[roomId]/page.tsx](file:///d:/dlowphim/frontend/src/app/watch-together/room/%5BroomId%5D/page.tsx):
  - L233: Khởi tạo `sessionEpochRef = useRef(1)` và `sendTrackerRef = useRef(createSendTrackerState("session_1"))`.
  - L935-L945: Dọn dẹp phiên socket, tăng `sessionEpochRef` và reset sạch `sendTrackerRef`.
  - L974-L1005: Xử lý batch auto-scroll qua `evaluateBatchAutoScroll`.
  - L1304-L1345: Gửi `clientNonce`, đối chiếu `sendEpoch`, xác nhận `messageId` từ ACK và kích hoạt cuộn tức thì nếu echo đã render trước.
  - L1581 & L1610: Chuyển container thành `items-center md:justify-center`, phần tử con `my-auto md:my-0 py-4 md:py-0 shrink-0`.
- [frontend/src/app/watch-together/create/[slug]/page.tsx](file:///d:/dlowphim/frontend/src/app/watch-together/create/%5Bslug%5D/page.tsx):
  - L407-L465: Duy trì baseline desktop `d0fa019` (`p-6`, switch `w-10 h-6`, input `h-12`).
- [frontend/src/utils/watchTogetherFlow.test.ts](file:///d:/dlowphim/frontend/src/utils/watchTogetherFlow.test.ts):
  - Kiểm thử toàn diện 12 kịch bản `messageId`, out-of-order ACK/Echo, session cleanup, cùng tài khoản khác thiết bị, cùng text khác messageId, timeout và error.

---

## 3. Nguyên Nhân & Giải Pháp Chi Tiết Từng Finding

### Finding 1: Đối Chiếu Chính Xác Lần Gửi Cục Bộ Với Echo Qua Server `messageId`
* **Nguyên nhân thực tế**:
  - Khi người dùng gửi tin trên máy A (đang đọc tin cũ), nếu cùng tài khoản đó gửi tin từ máy B (thiết bị khác), tin nhắn từ máy B đến máy A có cùng `senderId`.
  - Cơ chế trước đây không đối chiếu `message.id` mà dùng FIFO `shift()`, dẫn đến việc máy A lầm tưởng tin từ máy B là của mình và giật cuộn xuống đáy.
* **Giải pháp khắc phục**:
  - Backend `rooms.gateway.ts` (L655) trả về: `{ ok: true, messageId: savedMsg._id.toString() }`.
  - Khi bấm gửi trên phiên này: Tạo `clientNonce` lưu vào `pendingSends`.
  - Khi ACK trả về: Gắn `messageId` vào entry `clientNonce` tương ứng qua `confirmLocalSendAck`.
  - Khi batch tin nhắn đến: Chỉ cuộn nếu `options.newMessages` chứa đúng `msg.id === entry.messageId`.
  - **Xử lý Echo trước ACK**: Nếu echo xuất hiện trong `messages` trước khi ACK phản hồi, `receivedMessageIds.has(messageId)` ghi nhận trước. Khi ACK về, hàm `confirmLocalSendAck` trả về `shouldImmediateScroll: true` và kích hoạt cuộn ngay lập tức mà không cần đợi tin nhắn tiếp theo!
  - **Cùng tài khoản khác thiết bị / Cùng nội dung text**: Do `msg.id` của máy B khác với `messageId` được cấp cho máy A, máy A **hoàn toàn không cuộn** khi đang đọc tin cũ và bảo toàn nguyên vẹn pending send của mình!

### Finding 2: Quản Lý Vòng Đời Phiên (Session Epoch & Stale Callback Cleanup)
* **Nguyên nhân thực tế**:
  - Khi đổi phòng, reconnect tạo socket mới hoặc unmount component, các callback socket đang chờ (in-flight) có thể phản hồi muộn và làm biến đổi state của phiên mới.
* **Giải pháp khắc phục**:
  - Quản lý `sessionEpochRef` tăng dần mỗi khi socket teardown/reconnect (`sessionEpochRef.current += 1`).
  - Mỗi lần gửi tin nhắn lưu lại `sendEpoch = sessionEpochRef.current` và `sendRoomId = room?.roomId`.
  - Khi callback ACK/timeout được gọi: kiểm tra `if (sessionEpochRef.current !== sendEpoch || room?.roomId !== sendRoomId) return;`.
  - Callback cũ bị loại bỏ hoàn toàn, không thể thay đổi `sendTracker`, `messageInput`, `socketError` hay `isSendingMessage`.

### Finding 3: Khắc Phục Kẹt Cuộn & Cắt Phần Đầu Màn Chờ Mobile
* **Nguyên nhân thực tế**:
  - Lớp container `overflow-y-auto` trên mobile có chứa `justify-center`. Theo quy chuẩn CSS Flexbox, khi nội dung vượt quá chiều cao container, `justify-center` đẩy đỉnh của nội dung lên toạ độ âm ($-42.6\text{px}$ tại root font 20px / 32px), khiến thanh cuộn không thể cuộn lên trên đỉnh.
* **Giải pháp khắc phục**:
  - Container overlay (L1581): `flex flex-col items-center md:justify-center px-4 md:px-6 overflow-y-auto md:overflow-hidden`.
  - Phần tử con (L1610): `my-auto md:my-0 py-4 md:py-0 shrink-0`.
  - **Đo đạc thực tế**:
    - Khi nội dung nhỏ hơn màn hình: `my-auto` tự động căn giữa theo trục dọc.
    - Khi nội dung lớn hơn màn hình (font 20px / 32px, màn 390px): `my-auto` co về 0, đỉnh nội dung bắt đầu chính xác tại toạ độ $y = 16\text{px}$ (`py-4`), người dùng cuộn mượt mà từ Clock icon / badge ở đỉnh xuống tận nút bấm ở đáy.
    - Trên desktop $\ge 768$px: Áp dụng `md:justify-center md:overflow-hidden md:my-0 md:py-0 md:px-6` khớp 100% với baseline `d0fa019`.

---

## 4. Bảng So Sánh Chi Tiết Trước / Sau Bản Sửa

| Kịch bản kiểm thử | Trước bản sửa | Sau bản sửa |
| :--- | :--- | :--- |
| **Cùng tài khoản nhắn từ thiết bị khác** | Giật cuộn xuống đáy trên máy đang đọc tin cũ | **Giữ nguyên vị trí đọc tin cũ (`shouldScroll = false`)** |
| **Hai thiết bị cùng tài khoản gửi cùng text "Alo"** | Nhận nhầm vì cùng text | **Phân biệt độc lập 100% qua `messageId`** |
| **Echo về trước ACK** | Không cuộn kịp, chờ tin sau | **ACK về kích hoạt cuộn tức thì (`shouldImmediateScroll = true`)** |
| **Cleanup khi đang pending / Callback trễ** | Rò rỉ pending send sang phiên mới | **`sessionEpoch` hủy toàn bộ callback trễ, reset tracker sạch** |
| **Màn chờ mobile font lớn (20px / 32px)** | Bị cắt phần đầu (toạ độ âm $-42.6\text{px}$) | **Bắt đầu tại $y \ge 0$, cuộn tới được cả đầu và cuối** |
| **Desktop $\ge 768$px Baseline** | Lệch typography / thừa padding | **Khôi phục 100% baseline `d0fa019`** |

---

## 5. Bằng Chứng & Kết Quả Kiểm Thử

### 5.1. Unit Test Runner (`npm run test:watch`)
```text
> frontend@0.1.0 test:watch
> node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test src/utils/episodeUtils.test.ts src/utils/watchPlaybackFlow.test.ts src/utils/watchTogetherFlow.test.ts

✔ normalizes common PhimAPI and OPhim episode labels (1.10ms)
✔ matches an OPhim episode when the active episode came from PhimAPI (0.19ms)
✔ matches a PhimAPI episode when the active episode came from OPhim (0.10ms)
✔ uses a valid fallback when providers genuinely have different episodes (0.08ms)
✔ restores the same episode and time after PhimAPI fails over to OPhim (0.91ms)
✔ prefetches only near the end and selects the normalized next episode (0.79ms)
✔ honors a temporary global CDN block but allows it again after expiry (0.19ms)
✔ uses the stable HLS release and bounds media recovery with an audio codec swap (0.57ms)
✔ Messenger-style Chat Matrix A/B/C: aligns messages strictly by viewer identity, not room role (1.24ms)
✔ two users with identical display names ('Sad nhân') are never confused (0.13ms)
✔ Unified Identity Lifecycle: assert ID_render === ID_join === msg.senderId under storage errors and reconnect (0.18ms)
✔ handles storage failure or missing IDs gracefully without crashing (0.09ms)
✔ system messages are never marked as self messages (0.10ms)
✔ groups continuous messages from the same sender within 60 seconds (0.15ms)
✔ resolves correct fullscreen action across desktop container vs iOS Safari native video (0.10ms)
✔ isNearBottom: detects whether chat scroll is within bottom threshold (0.08ms)
✔ shouldAutoScrollChat: preserves reader position when reading old messages, ignores user object re-renders without new messages (0.10ms)
✔ evaluateBatchAutoScroll MessageId & Session Lifecycle: MessageId matching, out-of-order ACK/Echo, session cleanup, same-account different devices (0.49ms)
ℹ tests 18 | suites 0 | pass 18 | fail 0 | duration_ms 112.7ms
```
**Kết quả**: **18/18 tests PASSED** (100%).

### 5.2. TypeScript Typecheck (`npx tsc --noEmit`)
- **Kết quả**: 0 lỗi TypeScript (Exit code 0).

### 5.3. Next.js Production Build (`npm run build`)
- **Kết quả**: 21/21 routes biên dịch thành công (Exit code 0).
- `/watch-together/room/[roomId]`: Size 20.3 kB, First Load JS 126 kB.
- `/watch-together/create/[slug]`: Size 7.75 kB, First Load JS 114 kB.

### 5.4. Kiểm Tra Whitespace (`git diff --check`)
- **Kết quả**: 0 lỗi whitespace.

---

## 6. Quyền Sở Hữu Dữ Liệu & Socket (Ownership Verification)
- Tận dụng `messageId` đã có sẵn trong response ACK của backend gateway, không sửa đổi backend payload hay socket protocol.
- Toàn bộ trạng thái phiên được quản lý cục bộ qua `sendTrackerRef` và `sessionEpochRef`.
- Không tạo socket owner thứ hai, không thêm timer hay dependency ngoài.

---

## 7. Rủi Ro Còn Lại & Trạng Thái Thực Nghiệm (Remaining Risks)
* **Kiểm thử tự động & Build**: ✅ Đạt 100% typecheck, test runner và Next.js build.
* **Môi trường vật lý**: Cần người dùng trải nghiệm thực tế trên các thiết bị iPhone/Android khác nhau để đánh giá cảm giác cuộn và độ phản hồi socket thực tế.

---

## 8. Trạng Thái Git Hiện Tại
```text
 M frontend/src/app/watch-together/create/[slug]/page.tsx
 M frontend/src/app/watch-together/room/[roomId]/page.tsx
 M frontend/src/utils/watchTogetherFlow.test.ts
 M frontend/src/utils/watchTogetherFlow.ts
```
*(Dừng lại để Codex review source/diff và kiểm thử lại; tuyệt đối KHÔNG commit, push hoặc deploy).*
