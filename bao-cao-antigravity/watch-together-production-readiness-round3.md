# Báo Cáo Hoàn Thiện /watch-together Chuẩn Bị Production (Round 3)

## 1. Phạm Vi & Bối Cảnh (Scope & Baseline)
- **Repository**: `D:\dlowphim`
- **Mục tiêu**: Hoàn thiện toàn diện `/watch-together` để chuẩn bị production, sửa dứt điểm các lỗi danh tính chat (Messenger Model), hợp nhất nguồn định danh duy nhất (Single Identity Source of Truth), củng cố Safari WebKit Fullscreen native, và bảo đảm quyền kiểm soát phòng/đồng bộ.
- **Phạm vi bảo toàn & đóng băng (Frozen Scope)**:
  - Tuyệt đối **không sửa** route `/watch` (đang hoạt động hoàn hảo).
  - Không thay đổi layout/CSS desktop hay tạo nhánh player/socket riêng cho mobile/Safari.
  - Duy trì chính xác **1 video element** và **1 socket owner duy nhất** trên trang phòng.
  - Không commit, không push, không deploy, không sửa dữ liệu phòng thật.

---

## 2. Sơ Đồ Luồng Danh Tính Duy Nhất (Single Identity Pipeline)

```mermaid
graph TD
    A[Room Controller Mount] -->|1. Safe Init with try/catch| B(React State: guestId)
    C[AuthContext: user] -->|2. Auth Loading Guard| D{user?.id tồn tại?}
    D -- Có --> E[authenticatedUserId = user.id]
    D -- Không --> F[activeUserId = guestId]
    E --> G[Single Identity: activeUserId]
    F --> G
    
    G -->|3. Socket Join Payload| H[join_room: { roomId, userId: activeUserId }]
    G -->|4. Send Message| I[send_message: { roomId, userId: activeUserId }]
    G -->|5. Chat Render| J[isSelfMessage: msg.senderId === activeUserId]
    
    H --> K[Backend Gateway: xác thực JWT / gán userId]
    I --> L[Backend Service: saveMessage lưu senderId]
    L --> M[Realtime Broadcast: chatMsg.senderId = savedMsg.senderId]
    M --> J
```

* **Điểm mấu chốt**: Biến `activeUserId` được tính toán trực tiếp từ `authenticatedUserId || guestId` ở cấp Controller. Socket `useEffect` **không bao giờ tự khai báo biến `guestId` cục bộ hay tự sinh lại ID độc lập**.
* **Độ bền khi lỗi Storage**: Nếu `localStorage.getItem` ném lỗi `SecurityError` (Safari Private Browsing) hoặc `setItem` ném lỗi `QuotaExceededError`, giá trị `guestId` vẫn được giữ nguyên trong bộ nhớ React State xuyên suốt các lần reconnect socket của phiên.

---

## 3. Chi Tiết Các Bản Sửa Đã Thực Hiện

### 3.1. Sửa Dứt Điểm Chat Identity & Lỗi Tái Hiện Của Codex
* **Nguyên nhân xác minh**:
  - `frontend/src/app/watch-together/room/[roomId]/page.tsx` trước đây có `guestId` ở state, nhưng bên trong `useEffect` của socket vẫn khai báo `let guestId = ""` và tự đọc `localStorage` / tự sinh ID. Khi storage đọc bị chặn hoặc ghi lỗi, `ID_render` $\ne$ `ID_join`, dẫn đến `isMe = false`.
  - `handleSendMessage` trước đây truyền `userId: user?.id` (bị `undefined` đối với guest), phụ thuộc vào socket state của backend.
* **Bản sửa đã áp dụng**:
  - [page.tsx#L695-L730](file:///d:/dlowphim/frontend/src/app/watch-together/room/%5BroomId%5D/page.tsx#L695-L730): Xóa hoàn toàn `let guestId` cục bộ trong socket effect. Sử dụng trực tiếp `const activeUserId = authenticatedUserId || guestId`. Nếu `!activeUserId`, socket effect đợi định danh sẵn sàng trước khi kết nối.
  - [page.tsx#L1254-L1270](file:///d:/dlowphim/frontend/src/app/watch-together/room/%5BroomId%5D/page.tsx#L1254-L1270): `handleSendMessage` truyền `userId: activeUserId` chuẩn hóa.
  - [watchTogetherFlow.test.ts#L95-L150](file:///d:/dlowphim/frontend/src/utils/watchTogetherFlow.test.ts#L95-L150): Bổ sung test case giả lập vòng đời danh tính, khẳng định `ID_render === ID_join === msg.senderId` cả khi `getItem` throw, `setItem` throw và qua reconnect.

### 3.2. Đánh Giá Trường Hợp HELLO Trên Safari
* **Hiện trạng xác minh**:
  - Source code hiện tại đã có `authLoading` guard ngăn socket kết nối khi `AuthContext` chưa tải xong.
  - Hệ thống định danh chat đã chuyển đổi 100% sang so sánh `senderId` (UserId / GuestId), loại bỏ hoàn toàn việc fallback theo `displayName` (vốn là nguyên nhân tiềm ẩn nếu tên "HELLO" có khoảng trắng hoặc case mismatch).
* **Phần chưa xác minh**: Do chưa có thiết bị iPhone Safari vật lý đang đăng nhập tài khoản "HELLO" để bắt gói tin mạng thực tế, Antigravity **chưa tuyên bố hoàn thành dựa trên suy đoán**. Mã nguồn đã được bảo đảm chặt chẽ về mặt hợp đồng logic.

### 3.3. Hoàn Thiện Safari Fullscreen & Callback Ref
* **Nguyên nhân xác minh**:
  - iOS WebKit trên iPhone không hỗ trợ Fullscreen trên thẻ `div` (container), chỉ hỗ trợ native WebKit Fullscreen trên phần tử `<video>`.
  - Khi component khởi tạo, `videoRef.current` ban đầu là `null` do dữ liệu phòng đang tải.
* **Bản sửa đã áp dụng**:
  - Sử dụng `videoRefCallback = useCallback((node) => { videoRef.current = node; setVideoElement(node); }, [])` trên thẻ `<video>`.
  - `useEffect` phụ thuộc `[videoElement]`, gắn listener `webkitbeginfullscreen` và `webkitendfullscreen` ngay khi DOM node video xuất hiện và cleanup khi node unmount.
  - Điều hướng fullscreen trung thực qua `resolveFullscreenAction`: Nếu container fullscreen có sẵn $\rightarrow$ gọi container; nếu chỉ có video fullscreen (iOS Safari) $\rightarrow$ gọi `video.webkitEnterFullscreen()`. Bắt lỗi Promise rejection bằng `setErrorModal`, không giả lập `setIsFullscreen(true)`.

### 3.4. Quyền Host / Guest & Đồng Bộ Video
* **Host**: Toàn quyền điều khiển play, pause, seek, đổi tập. Backend kiểm tra JWT và quyền phòng (`roomHostId === authenticatedUserId`) cho mọi event.
* **Guest**: Chỉ điều chỉnh âm lượng và fullscreen cục bộ. Khi Guest ở Fullscreen native của iOS (có controls hệ thống QuickTime), các listener `play`/`pause`/`seeked` trên thẻ `<video>` chặn phát socket và tự động hội tụ về tiến trình của Host.

---

## 4. Kết Quả Kiểm Thử Thực Tế

### 4.1. Frontend Unit Tests (`npm run test:watch`)
```text
> frontend@0.1.0 test:watch
> node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test src/utils/episodeUtils.test.ts src/utils/watchPlaybackFlow.test.ts src/utils/watchTogetherFlow.test.ts

✔ normalizes common PhimAPI and OPhim episode labels (1.12ms)
✔ matches an OPhim episode when the active episode came from PhimAPI (0.18ms)
✔ matches a PhimAPI episode when the active episode came from OPhim (0.09ms)
✔ uses a valid fallback when providers genuinely have different episodes (0.07ms)
✔ restores the same episode and time after PhimAPI fails over to OPhim (0.89ms)
✔ prefetches only near the end and selects the normalized next episode (0.23ms)
✔ honors a temporary global CDN block but allows it again after expiry (0.17ms)
✔ uses the stable HLS release and bounds media recovery with an audio codec swap (0.81ms)
✔ Messenger-style Chat Matrix A/B/C: aligns messages strictly by viewer identity, not room role (1.31ms)
✔ two users with identical display names ('Sad nhân') are never confused (0.13ms)
✔ Unified Identity Lifecycle: assert ID_render === ID_join === msg.senderId under storage errors and reconnect (0.26ms)
✔ handles storage failure or missing IDs gracefully without crashing (0.16ms)
✔ system messages are never marked as self messages (0.12ms)
✔ groups continuous messages from the same sender within 60 seconds (0.14ms)
✔ resolves correct fullscreen action across desktop container vs iOS Safari native video (0.13ms)
ℹ tests 15 | suites 0 | pass 15 | fail 0 | duration_ms 110.1ms
```
**Kết quả**: 15/15 tests PASSED (100%).

### 4.2. Frontend Typecheck (`npx tsc --noEmit`)
- **Kết quả**: 0 lỗi TypeScript (Exit code 0).

### 4.3. Frontend Production Build (`npm run build`)
- **Kết quả**: Biên dịch Next.js 14 thành công 21/21 routes tĩnh và động (Exit code 0).
- Route `/watch-together/room/[roomId]`: Size 19.2 kB, First Load JS 125 kB.

### 4.4. Backend Tests (`npm test -- rooms.gateway.spec.ts --runInBand` & `rooms.service.spec.ts`)
- `rooms.gateway.spec.ts`: **17/17 tests PASSED** (Exit code 0).
- `rooms.service.spec.ts`: **6/6 tests PASSED** (Exit code 0).

### 4.5. Backend Production Build (`npm run build`)
- **Kết quả**: `nest build` hoàn thành không có lỗi (Exit code 0).

### 4.6. Git Whitespace Check (`git diff --check`)
- **Kết quả**: 0 lỗi whitespace.

---

## 5. Trạng Thái Xác Minh Thiết Bị Thực Tế

| Môi trường / Thiết bị | Phương pháp kiểm tra | Trạng thái | Ghi chú |
| :--- | :--- | :---: | :--- |
| **Logic cô lập & Unit Tests** | Node.js Test Runner (15 tests) | ✅ ĐẠT | Bao phủ Ma trận A/B/C, lỗi storage, reconnect, fullscreen dispatch |
| **Backend Gateway & Safety** | Jest Test Suite (23 tests) | ✅ ĐẠT | Bao phủ quyền Host/Guest, JWT session, room lifecycle |
| **Chrome Desktop (Windows)** | Runtime kiểm thử cục bộ | ✅ ĐẠT | Chat Messenger model căn đúng lề, Container Fullscreen mở chuẩn |
| **Android Chrome** | Giả lập & đối chiếu engine | ✅ ĐẠT | Không có regression |
| **iPhone Safari vật lý** | Thiết bị thực tế | ⚠️ **Chờ xác minh thiết bị** | Mã nguồn WebKit native đã hoàn tất; cần kiểm tra trực tiếp khi có máy |

---

## 6. Kế Hoạch Rollout Đề Xuất (Chỉ mang tính kế hoạch — Không thực hiện deploy)
1. **Bước 1: Backend Deployment**:
   - Deploy backend chứa schema `senderId` mới và cập nhật `saveMessage` / `handleSendMessage`.
   - Backend hoàn toàn tương thích ngược với tin nhắn cũ (fallback sang `sender` ObjectId nếu `senderId` chưa có).
2. **Bước 2: Frontend Deployment**:
   - Deploy frontend với Single Identity Pipeline và callback ref fullscreen.
   - Các client cũ đang mở sẽ tự động nạp code mới khi reload trang.

---

## 7. Trạng Thái Git Hiện Tại
```text
 M backend/src/rooms/rooms.gateway.ts
 M backend/src/rooms/rooms.service.ts
 M backend/src/rooms/schemas/message.schema.ts
 M frontend/package.json
 M frontend/src/app/watch-together/room/[roomId]/page.tsx
?? bao-cao-antigravity/watch-together-production-readiness-round3.md
?? bao-cao-antigravity/watch-together-safari-chat-fullscreen-repair.md
?? bao-cao-antigravity/watch-together-safari-chat-fullscreen-review-correction.md
?? frontend/src/utils/watchTogetherFlow.test.ts
?? frontend/src/utils/watchTogetherFlow.ts
```

---

## 8. Kết Luận & Đánh Giá
- **Trạng thái**: ✅ **Sẵn sàng để Codex review mã nguồn và logic** | ⚠️ **Chờ xác minh thiết bị đối với iPhone Safari vật lý**.
- **Không có bất kỳ thao tác commit, push hoặc deploy nào được thực hiện**.
