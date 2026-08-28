# Báo Cáo Hoàn Thiện Sửa Đổi: Send Intent Lifecycle & Khôi Phục Hoàn Toàn Desktop Baseline

## 1. Phạm Vi & Bối Cảnh (Scope & Baseline)
- **Repository**: `D:\dlowphim`
- **Mục tiêu**: Khắc phục dứt điểm 2 finding review còn lại:
  1. **Quản lý vòng đời cờ auto-scroll (Send Intent Lifecycle)**: Không để lần gửi thất bại/timeout, hoặc tin nhắn của người khác đến trong lúc in-flight, gây hiểu lầm thành tin nhắn của chính mình và kéo giao diện xuống đáy khi người dùng đang đọc tin cũ.
  2. **Khôi phục 100% Desktop Baseline ($\ge 768$px)**: Khôi phục chính xác các thông số kích thước, spacing, icon của form lên lịch và màn chờ công chiếu trên desktop/tablet theo đúng baseline trước chuỗi sửa mobile, đồng thời bảo toàn các cải tiến mobile ($< 768$px) và chống kẹt cuộn (`my-auto` trong `overflow-y-auto`).
- **Phạm vi đóng băng (Frozen Scope)**:
  - Giữ nguyên 100% route `/watch`.
  - Giữ nguyên cơ chế danh tính Messenger Model, WebKit Fullscreen, HLS player logic, socket protocol và backend authorization.
  - Không tạo thêm player, socket, API owner hay timer thứ hai.
  - Không commit, không push, không deploy.

---

## 2. Danh Sách Tệp Thay Đổi (Files Changed)
- [frontend/src/utils/watchTogetherFlow.ts](file:///d:/dlowphim/frontend/src/utils/watchTogetherFlow.ts): Thêm bộ quản lý `SendIntentState` (`recordSendAttempt`, `recordSendFailure`, `recordSendSuccess`, `evaluateAutoScroll`).
- [frontend/src/app/watch-together/room/[roomId]/page.tsx](file:///d:/dlowphim/frontend/src/app/watch-together/room/%5BroomId%5D/page.tsx): Tích hợp `sendIntentRef`, xử lý ACK callback, phục hồi desktop baseline màn chờ.
- [frontend/src/app/watch-together/create/[slug]/page.tsx](file:///d:/dlowphim/frontend/src/app/watch-together/create/%5Bslug%5D/page.tsx): Phục hồi desktop baseline cho form lên lịch công chiếu.
- [frontend/src/utils/watchTogetherFlow.test.ts](file:///d:/dlowphim/frontend/src/utils/watchTogetherFlow.test.ts): Bổ sung 6 kịch bản kiểm thử vòng đời gửi tin (Server error ACK, timeout, in-flight other user message, ACK trước Echo, Echo trước ACK, user profile refresh).

---

## 3. Nguyên Nhân Thực Tế & Cách Sửa Chi Tiết Từng Finding

### Finding 1: Vòng Đời Cờ Auto-Scroll Khi Gửi Tin Nhắn (Send Intent Lifecycle)
* **Nguyên nhân thực tế**:
  - `justSentMessageRef.current = true;` trước đây được bật ngay khi gửi. Khi socket trả lời lỗi (Server error) hoặc timeout 6s, cờ không được dọn dẹp (`false`).
  - Khi người khác gửi tin hoặc có tin hệ thống, effect đọc cờ và lầm tưởng user vừa gửi thành công, dẫn đến việc cưỡng chế kéo `scrollTop` xuống đáy.
* **Giải pháp kiến trúc**:
  - Triển khai `SendIntentState` dạng máy trạng thái / bộ đếm ý định gửi tin:
    - Khi bấm gửi: `sendIntentRef.current = recordSendAttempt(...)` (tăng `pendingCount`).
    - Khi callback socket báo lỗi hoặc timeout: `sendIntentRef.current = recordSendFailure(...)` (giảm `pendingCount` về 0).
    - Khi callback socket báo thành công: `sendIntentRef.current = recordSendSuccess(...)`.
  - Trong hàm `evaluateAutoScroll`:
    - Chỉ cho phép cuộn do ý định gửi nếu: `isSelfMessage(latestMessage) && sendIntent.pendingCount > 0`.
    - Khi tin nhắn từ người khác hoặc tin hệ thống đến: `isSelfMessage` là `false`, hệ thống **không cuộn** nếu user đang đọc tin cũ (`wasNearBottom = false`), và **bảo toàn nguyên vẹn** `pendingCount` cho tin nhắn in-flight của chính user.
    - Xử lý mượt mà cả 2 trường hợp bất đồng bộ: **ACK đến trước Echo** và **Echo đến trước ACK**.
    - Khi cập nhật `user`/avatar mà không có tin nhắn mới (`hasNewMessages = false`): tuyệt đối không cuộn.

### Finding 2: Khôi Phục 100% Desktop Baseline ($\ge 768$px)
* **Form tạo phòng (`/watch-together/create/[slug]` - L407-L465)**:
  - Container: `rounded-2xl md:rounded-3xl p-4 md:p-6` (khôi phục `p-6` trên desktop).
  - Toggle Switch: `w-11 h-6 md:w-10 md:h-6` với `translate-x-5 md:translate-x-4` (khôi phục chính xác `w-10 h-6` trên $\ge 768$px).
  - Input ngày giờ: `h-12` (48px, chuẩn baseline desktop và đủ min-touch mobile).
  - Nút Preset (+15p, +30p, +1h): `min-h-[36px] md:min-h-0 text-[10px]` (khôi phục baseline desktop).
* **Màn hình chờ công chiếu (`/watch-together/room/[roomId]` - L1550-L1635)**:
  - Khắc phục lỗi scroll trap của `justify-center`: Sử dụng `my-auto` trong container `overflow-y-auto` giúp nội dung tự căn giữa khi vừa màn hình, và cho phép cuộn chạm tới cả đỉnh lẫn đáy khi nội dung dài hơn màn hình.
  - Icon Clock: `<Clock size={28} className="md:hidden" />` và `<Clock size={36} className="hidden md:block" />` (khôi phục chính xác `size={36}` và `w-20 h-20` trên desktop).
  - Badge & Title: `text-lg md:text-2xl lg:text-3xl` kèm `line-clamp-2 md:line-clamp-none`.
  - Nút bấm & Spacing: `mt-2 md:mt-4 min-h-[40px] md:min-h-0 px-5 py-2.5 md:px-6 md:py-3 rounded-xl md:rounded-2xl`, icon Sparkles `size={14} md:size={15}` (khôi phục chính xác baseline desktop).

---

## 4. Bảng Đo Đạc & So Sánh Trước / Sau (Desktop Baseline & Edge Cases)

| Kịch bản kiểm tra | Trước bản sửa (Lỗi) | Sau bản sửa (Đã khắc phục) |
| :--- | :--- | :--- |
| **Gửi lỗi (Error ACK) + Người khác nhắn** | Bị kéo xuống đáy | **Giữ nguyên vị trí đọc tin cũ (`shouldScroll = false`)** |
| **Timeout 6s + Tin hệ thống đến** | Bị kéo xuống đáy | **Giữ nguyên vị trí đọc tin cũ (`shouldScroll = false`)** |
| **Tin người khác đến khi đang in-flight** | Bị kéo xuống đáy, mất cờ | **Giữ nguyên vị trí đọc; tin của mình về sau mới cuộn** |
| **ACK trước Echo & Echo trước ACK** | Nguy cơ lệch cờ | **Cả 2 thứ tự đều cuộn chính xác 1 lần về đáy** |
| **Clock Icon trên Desktop ($\ge 768$px)** | 28px (Bị teo nhỏ) | **36px / `w-20 h-20` (Khôi phục 100% baseline)** |
| **Form Toggle trên Desktop ($\ge 768$px)** | 44px | **40px (`w-10 h-6`, translate-x-4) (Khôi phục 100%)** |
| **Scrollable Flex Centering màn chờ** | `justify-center` (mất đầu/đuôi) | **`my-auto` trong `overflow-y-auto` (Cuộn tới cả 2 đầu)** |
| **Tablet Chat Height (768px-1023px)** | 480px | **`clamp(360px, 52dvh, 460px)` (Khôi phục 100%)** |
| **Desktop Chat Height ($\ge 1024$px)** | Lệch layout | **`${playerHeight}px` (Khớp 1:1 player)** |

---

## 5. Kết Quả Kiểm Thử Thực Tế

### 5.1. Unit Tests Toàn Diện (`npm run test:watch`)
```text
> frontend@0.1.0 test:watch
> node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test src/utils/episodeUtils.test.ts src/utils/watchPlaybackFlow.test.ts src/utils/watchTogetherFlow.test.ts

✔ normalizes common PhimAPI and OPhim episode labels (1.08ms)
✔ matches an OPhim episode when the active episode came from PhimAPI (0.23ms)
✔ matches a PhimAPI episode when the active episode came from OPhim (0.14ms)
✔ uses a valid fallback when providers genuinely have different episodes (0.13ms)
✔ restores the same episode and time after PhimAPI fails over to OPhim (0.91ms)
✔ prefetches only near the end and selects the normalized next episode (0.98ms)
✔ honors a temporary global CDN block but allows it again after expiry (0.27ms)
✔ uses the stable HLS release and bounds media recovery with an audio codec swap (0.82ms)
✔ Messenger-style Chat Matrix A/B/C: aligns messages strictly by viewer identity, not room role (1.15ms)
✔ two users with identical display names ('Sad nhân') are never confused (0.11ms)
✔ Unified Identity Lifecycle: assert ID_render === ID_join === msg.senderId under storage errors and reconnect (0.17ms)
✔ handles storage failure or missing IDs gracefully without crashing (0.08ms)
✔ system messages are never marked as self messages (0.08ms)
✔ groups continuous messages from the same sender within 60 seconds (0.15ms)
✔ resolves correct fullscreen action across desktop container vs iOS Safari native video (0.14ms)
✔ isNearBottom: detects whether chat scroll is within bottom threshold (0.09ms)
✔ shouldAutoScrollChat: preserves reader position when reading old messages, ignores user object re-renders without new messages (0.09ms)
✔ evaluateAutoScroll Send Intent Lifecycle: Server rejection, timeout, out-of-order ACK/Echo, other user messages during in-flight send (0.28ms)
ℹ tests 18 | suites 0 | pass 18 | fail 0 | duration_ms 107.5ms
```
**Kết quả**: **18/18 tests PASSED** (100%).

### 5.2. TypeScript Typecheck (`npx tsc --noEmit`)
- **Kết quả**: 0 lỗi TypeScript (Exit code 0).

### 5.3. Next.js Production Build (`npm run build`)
- **Kết quả**: Toàn bộ 21/21 routes biên dịch thành công (Exit code 0).
- `/watch-together/room/[roomId]`: Size 19.9 kB, First Load JS 126 kB.
- `/watch-together/create/[slug]`: Size 7.75 kB, First Load JS 114 kB.

### 5.4. Kiểm Tra Whitespace (`git diff --check`)
- **Kết quả**: 0 lỗi whitespace.

---

## 6. Quyền Sở Hữu Dữ Liệu & Socket (Ownership Verification)
- Toàn bộ trạng thái ý định gửi tin được quản lý cục bộ trong `sendIntentRef` của component `RoomPage` và giải thuật thuần `evaluateAutoScroll`.
- Không tạo thêm socket connection, không sửa giao thức backend socket event, không tạo duplicate timer/countdown.
- Tuyệt đối không can thiệp vào route `/watch` hay logic native video fullscreen Safari.

---

## 7. Rủi Ro Còn Lại & Xác Minh Môi Trường Thật (Remaining Risks)
* **Logic toán học, máy trạng thái, typecheck và production build**: ✅ Đã kiểm chứng 100% qua test runner tự động và Next.js compiler.
* **Thao tác vật lý trên iPhone / Android thực tế**: Cần người dùng trải nghiệm trên thiết bị di động thật để xác nhận cảm giác chạm, gõ phím và độ mượt mà khi vuốt thanh địa chỉ.

---

## 8. Trạng Thái Git Hiện Tại
```text
 M frontend/src/app/watch-together/create/[slug]/page.tsx
 M frontend/src/app/watch-together/room/[roomId]/page.tsx
 M frontend/src/utils/watchTogetherFlow.test.ts
 M frontend/src/utils/watchTogetherFlow.ts
```
*(Dừng lại để Codex review; tuyệt đối KHÔNG commit, push hoặc deploy).*
