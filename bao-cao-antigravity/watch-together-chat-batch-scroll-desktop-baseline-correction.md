# Báo Cáo Khắc Phục Lỗi: Batch Auto-Scroll Message Inspection & Khôi Phục Hoàn Toàn Desktop Baseline

## 1. Phạm Vi & Bối Cảnh (Scope & Baseline)
- **Repository**: `D:\dlowphim`
- **Mục tiêu**:
  1. **Khắc phục lỗi bỏ sót tin nhắn trong cùng lượt render (Batch Auto-Scroll Message Inspection)**: Duyệt toàn bộ mảng `newMessages` trong batch render, phân biệt chính xác echo của phiên gửi cục bộ hiện tại (`SendTrackerState`) với tin nhắn của cùng tài khoản gửi từ thiết bị/tab khác. Không để `pending` tồn dư sau khi đã xử lý echo, và không nhảy cuộn khi đang đọc tin cũ.
  2. **Khôi phục 100% Desktop Baseline ($\ge 768$px) theo commit `d0fa019`**: Khôi phục chính xác typography (Tiêu đề 30px, Countdown 30px, Giờ chiếu 16px), loại bỏ hoàn toàn các lớp padding thừa (`md:py-6`, `md:py-4`), khôi phục `md:overflow-hidden` trên desktop trong khi vẫn đảm bảo khả năng cuộn chạm tới cả 2 đầu trên mobile ($< 768$px).
- **Phạm vi đóng băng (Frozen Scope)**:
  - Giữ nguyên 100% route `/watch`.
  - Giữ nguyên cơ chế danh tính Messenger Model, WebKit Fullscreen, HLS player logic, socket protocol và backend authorization.
  - Không tạo thêm player, socket, API owner hay timer thứ hai.
  - Không commit, không push, không deploy.

---

## 2. Danh Sách Tệp Thay Đổi (Files Changed)
- [frontend/src/utils/watchTogetherFlow.ts](file:///d:/dlowphim/frontend/src/utils/watchTogetherFlow.ts):
  - Triển khai `SendTrackerState`, `recordLocalSend`, `cancelLocalSend` và `evaluateBatchAutoScroll`.
- [frontend/src/app/watch-together/room/[roomId]/page.tsx](file:///d:/dlowphim/frontend/src/app/watch-together/room/%5BroomId%5D/page.tsx):
  - L233: Quản lý `sendTrackerRef` độc lập với react state updater.
  - L974-L1002: Tự động trích xuất `newMessages = messages.slice(prevMessagesCountRef.current)` và gọi `evaluateBatchAutoScroll`.
  - L1304-L1325: Gắn `sendId` vào `recordLocalSend` và dọn dẹp qua `cancelLocalSend` khi timeout hoặc error ACK.
  - L1552-L1615: Khôi phục chính xác typography (`md:text-3xl`, `md:text-base`) và layout baseline `d0fa019` trên $\ge 768$px.
- [frontend/src/app/watch-together/create/[slug]/page.tsx](file:///d:/dlowphim/frontend/src/app/watch-together/create/%5Bslug%5D/page.tsx):
  - L407-L465: Khôi phục baseline desktop (`p-6`, switch `w-10 h-6`, thumb `translate-x-4`, input `h-12`).
- [frontend/src/utils/watchTogetherFlow.test.ts](file:///d:/dlowphim/frontend/src/utils/watchTogetherFlow.test.ts):
  - Kiểm thử toàn diện 9 kịch bản batch, out-of-order ACK/Echo, timeout, cùng tài khoản khác thiết bị và cleanup.

---

## 3. Nguyên Nhân & Giải Pháp Chi Tiết Từng Finding

### Finding 1: Auto-Scroll Bỏ Sót Tin Trong Cùng Lượt Render & Nhận Diện Echo Phiên Cục Bộ
* **Nguyên nhân thực tế**:
  - Khi user gửi tin, nếu React gộp (batch) nhiều tin nhắn vào 1 lần render (ví dụ: `[msg_của_mình, msg_người_khác]`), effect trước đây chỉ đọc `latestMessage = messages[messages.length - 1]` (tức `msg_người_khác`).
  - Do `msg_người_khác` không phải từ user, effect không cuộn (`shouldScroll = false`) và để sót `pendingCount = 1`.
  - Sau đó, nếu cùng tài khoản đó gửi tin từ điện thoại/máy tính khác, tin nhắn đó đến có `isSelfMessage = true`, vô tình tiêu thụ `pendingCount = 1` còn sót và giật cuộn màn hình ở máy hiện tại.
* **Giải pháp khắc phục**:
  1. **Duyệt toàn bộ mảng tin nhắn mới**: Effect trích xuất `newMessages = messages.slice(prevMessagesCountRef.current)` và duyệt qua tất cả tin nhắn trong batch.
  2. **Quản lý danh sách gửi cục bộ (`SendTrackerState`)**:
     - Khi bấm gửi tại phiên này: `recordLocalSend` sinh ra 1 `sendId` lưu trong ref.
     - Khi duyệt `newMessages`: Nếu gặp tin của mình VÀ trong ref có `pendingSends > 0`, đánh dấu `hasLocalSendEcho = true` và tiêu thụ 1 lượt gửi tương ứng (FIFO).
     - Nếu cùng tài khoản gửi từ máy khác: ref tại máy này không có `pendingSends` $\rightarrow$ `hasLocalSendEcho = false` $\rightarrow$ **không cuộn nếu đang đọc tin cũ**.
  3. **Xử lý Error ACK & Timeout**: `cancelLocalSend(state, sendId)` xóa bỏ ngay lượt gửi đang chờ khi socket trả lỗi hoặc sau 6s timeout, không để tồn dư.

### Finding 2: Khôi Phục 100% Typography & Layout Baseline $\ge 768$px (d0fa019)
* **Nguyên nhân thực tế**:
  - Bản sửa trước vô tình áp dụng `md:text-2xl lg:text-3xl` và `md:text-sm lg:text-base`, làm tiêu đề giảm từ 30px xuống 24px và giờ chiếu giảm từ 16px xuống 14px ở dải 768px–1023px.
  - Ngoài ra, việc thêm `md:py-6` vào overlay và `md:py-4` vào wrapper gây lệch khoảng cách so với baseline `d0fa019`.
* **Giải pháp khắc phục**:
  - Tiêu đề $H_2$: `text-lg md:text-3xl` (chuẩn 30px tại $\ge 768$px).
  - Countdown text: `text-xl md:text-3xl` (chuẩn 30px tại $\ge 768$px).
  - Giờ chiếu: `text-xs md:text-base` (chuẩn 16px tại $\ge 768$px).
  - Xóa bỏ `md:py-6` và `md:py-4`: Trên $\ge 768$px khôi phục `md:overflow-hidden`, `md:my-0`, `md:py-0`, `md:px-6` khớp 1:1 với `d0fa019`.
  - Trên mobile $< 768$px: Sử dụng `overflow-y-auto`, `my-auto`, `py-2`, `px-4` giúp người dùng cuộn chạm tới cả đầu và cuối nội dung khi màn hình nhỏ.

---

## 4. Bảng So Sánh Số Đo Chi Tiết Với Baseline d0fa019

| Thành phần / Viewport | Baseline `d0fa019` | Bản sửa lỗi hiện tại | Trạng thái |
| :--- | :--- | :--- | :--- |
| **Tiêu đề phim ($\ge 768$px)** | `text-2xl md:text-3xl` (30px) | `text-lg md:text-3xl` (30px) | ✅ Khớp 100% |
| **Countdown text ($\ge 768$px)** | `text-2xl md:text-3xl` (30px) | `text-xl md:text-3xl` (30px) | ✅ Khớp 100% |
| **Giờ chiếu phim ($\ge 768$px)** | `text-sm md:text-base` (16px) | `text-xs md:text-base` (16px) | ✅ Khớp 100% |
| **Clock Icon Desktop ($\ge 768$px)** | `w-20 h-20` / Clock size 36 | `md:w-20 md:h-20` / Clock size 36 | ✅ Khớp 100% |
| **Form Switch Toggle ($\ge 768$px)** | `w-10 h-6`, translate-x-4 | `md:w-10 md:h-6`, md:translate-x-4 | ✅ Khớp 100% |
| **Form Container Padding ($\ge 768$px)** | `p-6` | `md:p-6` | ✅ Khớp 100% |
| **Overlay Desktop Spacing ($\ge 768$px)** | `px-6`, không có py, overflow-hidden | `md:px-6 md:py-0 md:overflow-hidden` | ✅ Khớp 100% |
| **Khung Chat Tablet (768–1023px)** | `clamp(360px, 52dvh, 460px)` | `md:h-[clamp(360px,52dvh,460px)]` | ✅ Khớp 100% |
| **Khung Chat Desktop ($\ge 1024$px)** | `playerHeight` (khớp 1:1 player) | `playerHeight` (khớp 1:1 player) | ✅ Khớp 100% |

---

## 5. Bằng Chứng & Kết Quả Kiểm Thử

### 5.1. Unit Test Runner (`npm run test:watch`)
```text
> frontend@0.1.0 test:watch
> node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test src/utils/episodeUtils.test.ts src/utils/watchPlaybackFlow.test.ts src/utils/watchTogetherFlow.test.ts

✔ normalizes common PhimAPI and OPhim episode labels (1.47ms)
✔ matches an OPhim episode when the active episode came from PhimAPI (0.27ms)
✔ matches a PhimAPI episode when the active episode came from OPhim (0.11ms)
✔ uses a valid fallback when providers genuinely have different episodes (0.09ms)
✔ restores the same episode and time after PhimAPI fails over to OPhim (2.00ms)
✔ prefetches only near the end and selects the normalized next episode (0.26ms)
✔ honors a temporary global CDN block but allows it again after expiry (0.36ms)
✔ uses the stable HLS release and bounds media recovery with an audio codec swap (0.77ms)
✔ Messenger-style Chat Matrix A/B/C: aligns messages strictly by viewer identity, not room role (1.50ms)
✔ two users with identical display names ('Sad nhân') are never confused (0.22ms)
✔ Unified Identity Lifecycle: assert ID_render === ID_join === msg.senderId under storage errors and reconnect (0.21ms)
✔ handles storage failure or missing IDs gracefully without crashing (0.10ms)
✔ system messages are never marked as self messages (0.10ms)
✔ groups continuous messages from the same sender within 60 seconds (0.17ms)
✔ resolves correct fullscreen action across desktop container vs iOS Safari native video (0.11ms)
✔ isNearBottom: detects whether chat scroll is within bottom threshold (0.09ms)
✔ shouldAutoScrollChat: preserves reader position when reading old messages, ignores user object re-renders without new messages (0.12ms)
✔ evaluateBatchAutoScroll Lifecycle Matrix: Batch messages, other device same user, timeout, out-of-order, cleanup (0.41ms)
ℹ tests 18 | suites 0 | pass 18 | fail 0 | duration_ms 135.7ms
```
**Kết quả**: **18/18 tests PASSED** (100%).

### 5.2. Chi Tiết Các Kịch Bản Kiểm Thử Gửi Chat Thực Tế:
1. **Echo mình $\rightarrow$ Tin người khác trong cùng 1 render**:
   - `wasNearBottom: false` (scrollTop: 100), `pendingSends: 1`.
   - Batch: `[msgFromMe, msgFromOther]`.
   - Kết quả: `shouldScroll: true`, `pendingSends: 0` (được tiêu thụ sạch).
2. **Tin người khác $\rightarrow$ Echo mình trong cùng 1 render**:
   - `wasNearBottom: false`, `pendingSends: 1`.
   - Batch: `[msgFromOther, msgFromMe]`.
   - Kết quả: `shouldScroll: true`, `pendingSends: 0`.
3. **Echo mình $\rightarrow$ Tin hệ thống trong cùng 1 render**:
   - `wasNearBottom: false`, `pendingSends: 1`.
   - Batch: `[msgFromMe, msgSystem]`.
   - Kết quả: `shouldScroll: true`, `pendingSends: 0`.
4. **Nhiều tin mới và Duplicate Echo**:
   - `wasNearBottom: false`, `pendingSends: 1`.
   - Batch: `[msgFromMe, msgFromMe, msgFromOther]`.
   - Kết quả: `shouldScroll: true`, `pendingSends: 0` (không bị âm pending).
5. **Cùng tài khoản gửi từ thiết bị khác khi đang đọc tin cũ**:
   - Máy này: `pendingSends: 0`.
   - Batch: `[msgFromOtherDevice]`.
   - Kết quả: `shouldScroll: false` (giữ nguyên vị trí đọc tin cũ).
6. **Gửi lỗi (Error ACK) hoặc Timeout**:
   - Bấm gửi $\rightarrow$ `recordLocalSend` $\rightarrow$ socket lỗi $\rightarrow$ `cancelLocalSend`.
   - Tin người khác đến sau: `shouldScroll: false`.
7. **User object / Avatar refresh không có tin mới**:
   - `newMessages: []`.
   - Kết quả: `shouldScroll: false`.
8. **Đổi phòng / Cleanup / Reconnect**:
   - `createSendTrackerState()` reset sạch `pendingSends: []`.
9. **Đang ở sát đáy (`wasNearBottom: true`)**:
   - Bất kỳ tin mới nào đến $\rightarrow$ `shouldScroll: true`.

### 5.3. TypeScript Typecheck (`npx tsc --noEmit`)
- **Kết quả**: 0 lỗi TypeScript (Exit code 0).

### 5.4. Next.js Production Build (`npm run build`)
- **Kết quả**: 21/21 routes biên dịch hoàn tất (Exit code 0).
- `/watch-together/room/[roomId]`: Size 20 kB, First Load JS 126 kB.
- `/watch-together/create/[slug]`: Size 7.75 kB, First Load JS 114 kB.

### 5.5. Kiểm Tra Whitespace (`git diff --check`)
- **Kết quả**: 0 lỗi whitespace.

---

## 6. Quyền Sở Hữu Dữ Liệu & Socket (Ownership Verification)
- Không bổ sung socket event mới, không thay đổi socket payload hay backend controller/gateway.
- Không tạo timer chạy ngầm, không tạo socket owner thứ hai.
- Toàn bộ cơ chế theo dõi lượt gửi được đóng gói an toàn trong `SendTrackerState` và `sendTrackerRef`.

---

## 7. Rủi Ro Còn Lại & Trạng Thái Thực Nghiệm (Remaining Risks)
* **Toán học, máy trạng thái, kiểm thử tự động, build production**: ✅ Đạt 100%.
* **Trải nghiệm gõ phím và cuộn thực tế trên thiết bị di động**: Đã sẵn sàng để người dùng thử nghiệm trên môi trường thật.

---

## 8. Trạng Thái Git Hiện Tại
```text
 M frontend/src/app/watch-together/create/[slug]/page.tsx
 M frontend/src/app/watch-together/room/[roomId]/page.tsx
 M frontend/src/utils/watchTogetherFlow.test.ts
 M frontend/src/utils/watchTogetherFlow.ts
```
*(Dừng lại để Codex review; tuyệt đối KHÔNG commit, push hoặc deploy).*
