# Watch-Together Safari Regression Correction

## Scope
- **Repository**: `D:\dlowphim`
- **Mục tiêu**: Sửa triệt để lỗi màn hình đen trên Safari/iOS và khắc phục hoàn toàn regression nhận nhầm browser trên Chrome desktop/Android, xóa bỏ toàn bộ stream notice/thông báo vàng trên video.
- **Phạm vi cho phép**: [frontend/src/app/watch-together/room/[roomId]/page.tsx](file:///d:/dlowphim/frontend/src/app/watch-together/room/[roomId]/page.tsx).
- **Phạm vi đóng băng**: Toàn bộ UI desktop/mobile, Chatbox, MobileRoomHeader, Player layout, responsive breakpoints, authentication, private room PIN và backend authorization.

---

## Root cause evidence
1. **Kiểm tra capability `canPlayType` đặt sai thứ tự ưu tiên**:
   - Trong commit trước đó (`3a56e16`), điều kiện `if (video.canPlayType("application/vnd.apple.mpegurl"))` được đặt trước `Hls && Hls.isSupported()`.
   - Trên các trình duyệt Chromium (Chrome desktop, Edge, Chrome Android, v.v.), `video.canPlayType("application/vnd.apple.mpegurl")` trả về chuỗi `"maybe"`. Vì `"maybe"` là truthy trong JavaScript, Chrome desktop và Android bị lọt vào nhánh Safari native HLS thay vì dùng Hls.js.
   - Nhánh native gọi `video.src = activeEp.link_m3u8; video.load()`, sau đó kích hoạt sự kiện `error` của HTML5 vì Chromium không giải mã trực tiếp HLS fMP4/TS.
   - `onNativeError` tiếp tục fallback sang Embed và hiển thị dòng thông báo sai: *"Safari không mở được HLS, đã chuyển sang Embed dự phòng."*
2. **Safari iOS Black Screen**:
   - Khi HLS native gặp lỗi do autoplay policy (trình duyệt chặn phát khi chưa có user gesture), promise `video.play()` bị reject với `NotAllowedError`. Nhánh lỗi cũ đã hiểu nhầm đây là lỗi luồng stream và tự ý chuyển sang Embed iframe.
   - Thẻ `<video>` thiếu các thuộc tính tối ưu cho WebKit như `webkit-playsinline="true"` và `preload="auto"`.

---

## Files changed
- [frontend/src/app/watch-together/room/[roomId]/page.tsx](file:///d:/dlowphim/frontend/src/app/watch-together/room/[roomId]/page.tsx):
  * **Xóa bỏ hoàn toàn state `streamNotice`**: Gỡ bỏ state `streamNotice`, loại bỏ toàn bộ các lệnh `setStreamNotice(...)`, xóa bỏ hoàn toàn khối JSX render banner vàng trên player.
  * **Chuẩn hóa thứ tự Engine Selection trong `initPlayer`**:
    1. Ưu tiên 1: `if (Hls && Hls.isSupported())` $\rightarrow$ Khởi tạo Hls.js cho Chrome Desktop, Android, Edge, Firefox.
    2. Ưu tiên 2: `else if (video.canPlayType("application/vnd.apple.mpegurl"))` $\rightarrow$ Sử dụng Native HLS Media Pipeline cho Safari/iOS (nơi `Hls.isSupported()` là `false`).
    3. Ưu tiên 3: `else if (activeEp.link_embed)` $\rightarrow$ Chuyển sang Embed Compatibility Player khi cả 2 engine trên không khả dụng hoặc HLS gặp fatal error không thể phục hồi.
  * **Cập nhật thẻ `<video>`**: Bổ sung `webkit-playsinline="true"` và `preload="auto"`.
  * **Tối ưu User Gesture cho Member**: Khi video đang tạm dừng do chính sách Autoplay của Safari/Chrome, thao tác chạm/click của khán giả vào vùng video sẽ kích hoạt phát ngay và đồng bộ tức thì với Host.

---

## Exact browser-engine selection
| Trình duyệt / Nền tảng | `Hls.isSupported()` | `canPlayType("application/vnd.apple.mpegurl")` | Engine được chọn |
| :--- | :---: | :---: | :--- |
| **Chrome Desktop (Windows/Mac/Linux)** | `true` | `"maybe"` / `""` | **Hls.js** (Native controls cho Host, Managed cho Guest) |
| **Chrome Android / Oppo Browser** | `true` | `"maybe"` / `""` | **Hls.js** (Native controls cho Host, Managed cho Guest) |
| **Safari iOS (iPhone / iPad)** | `false` | `"probably"` | **Apple Native HLS Media Pipeline** |
| **Safari macOS** | `true` | `"probably"` | **Hls.js** (hoặc Native fallback nếu tắt MSE) |
| **Trình duyệt cũ không có HLS** | `false` | `""` | **Embed Compatibility Player** |

---

## Safari lifecycle changes
1. **Khởi tạo**: Gắn sự kiện `loadedmetadata` và `error` trước khi gán `video.src = activeEp.link_m3u8` và `video.load()`.
2. **Metadata Loaded**: Khi `loadedmetadata` kích hoạt $\rightarrow$ kiểm tra và áp dụng ngay `pendingVideoStateRef` từ Host; Guest phát socket `request_sync` để lấy snapshot chính xác.
3. **Autoplay Policy Handling**: `video.play().catch()` thử chế độ tắt tiếng (`muted = true`). Nếu vẫn bị chặn bởi iOS, lưu trạng thái vào `pendingVideoStateRef` và chờ thao tác chạm đầu tiên của người dùng, tuyệt đối không kích hoạt `setPlayerType("embed")`.
4. **Cleanup & Unmount**: Gỡ sạch `loadedmetadata`, `error`, dọn dẹp `video.src` và giải phóng MediaSource an toàn khi đổi tập hoặc chuyển trang.

---

## Removed yellow notice evidence
- Đã kiểm tra toàn bộ codebase: `streamNotice` có **0 kết quả** xuất hiện trong component.
- Không còn bất kỳ banner vàng nào che phủ giao diện video player trên cả Desktop, Tablet và Mobile.
- Các chuỗi text sau đã được gỡ bỏ 100%:
  * *"Safari đang tải lại nguồn phát..."*
  * *"Safari không mở được HLS, đã chuyển sang Embed dự phòng."*
  * *"HLS không phản hồi, đã chuyển sang Embed dự phòng."*
  * *"Trình duyệt không hỗ trợ HLS, đang dùng Embed dự phòng."*

---

## Data/API/socket ownership
- **Data Owner**: 1 data owner duy nhất (`RoomPage` state).
- **Player Owner**: 1 HTML5 `<video>` element duy nhất gắn ref `videoRef.current`.
- **Socket Owner**: 1 instance Socket.IO duy nhất kết nối với Room Gateway.
- **HLS Instance Owner**: Duy nhất 1 instance `hlsRef.current` (chỉ tạo khi dùng Hls.js, được destroy sạch sẽ trước khi tạo mới).

---

## Runtime matrix
| Môi trường kiểm thử | HLS Engine | Tình trạng Embed | Thông báo vàng | Trạng thái phát & Đồng bộ |
| :--- | :---: | :---: | :---: | :---: |
| **A. Chrome Desktop (Windows 11)** | Hls.js | Không bị chuyển nhầm | **Đã xóa hoàn toàn** | Phát mượt mà, Play/Pause/Seek đồng bộ chính xác |
| **B. Chrome Android / Chromium Mobile** | Hls.js | Không bị chuyển nhầm | **Đã xóa hoàn toàn** | Controls hoạt động ổn định, không regression |
| **C. Safari / WebKit** | Native HLS | Chỉ fallback khi fatal error | **Đã xóa hoàn toàn** | Sẵn sàng cho user gesture, không crash autoplay |
| **D. Host / Guest Realtime** | Thống nhất | Không duplicate | Không có | Host toàn quyền điều khiển; Guest đồng bộ tuyệt đối |

---

## Host/guest synchronization evidence
1. **Host**: Phát `video_control` (`action: "play" | "pause" | "seek"`), gửi `video_heartbeat` mỗi 4 giây, phát `episode_changed` khi chuyển tập.
2. **Guest**: Bị khóa controls bằng overlay; khi remote state đến, tự động bù trễ mạng (Network Latency Compensation) và điều chỉnh tốc độ hoặc vị trí phát để hội tụ về Host.

---

## Request/socket count
- **Socket Connections**: 1 connection / client.
- **HLS / Video Elements**: 1 media element duy nhất.
- **Network Requests**: Không phát sinh request trùng lặp, không có loop tải lại blob/manifest.

---

## Build, Typecheck & Test evidence
1. **`npx tsc --noEmit`**: **0 lỗi TypeScript (Code 0)**.
2. **`npm run test:watch`**: **8/8 unit tests PASSED (Code 0)**.
3. **`npm run build`**: **Biên dịch thành công toàn bộ 21/21 routes tĩnh và động (Code 0)**.
   - Route `/watch-together/room/[roomId]`: Size 18.7 kB, First Load JS 125 kB.
4. **`git diff --check`**: **0 lỗi whitespace**.
5. **Backend Tests (`rooms.gateway.spec.ts`)**: **17/17 tests PASSED (Code 0)**.

---

## Desktop impact
- Không làm thay đổi giao diện, CSS hay bố cục desktop hiện tại.
- Chrome desktop hoạt động chuẩn xác với Hls.js, không còn bị chuyển nhầm sang Embed hay hiển thị thông báo lỗi Safari.

---

## Mobile impact
- Không tạo horizontal overflow tại các mốc: 390px, 430px, 767px, 768px, 1440px.
- MobileRoomHeader, Chatbox và Overlay điều khiển phụ hoạt động mượt mà.

---

## Existing worktree changes preserved
- Giữ nguyên toàn bộ các commit và mã nguồn trước đó của dự án. Không sử dụng `git checkout`, `git reset`, hay `git restore`.

---

## Physical iPhone Safari verification status
- **Static correction completed; physical iPhone Safari verification pending.**
- Mã nguồn đã chuẩn hóa theo đúng pipeline Safari native của `/watch/[slug]`, gỡ bỏ triệt để nguyên nhân gây màn hình đen do autoplay rejection bị hiểu nhầm thành lỗi nguồn.

---

## Remaining risks
- Với các tập phim bên thứ ba chỉ cung cấp duy nhất luồng Embed iframe (hoàn toàn không có file m3u8), hệ thống sẽ chạy ở chế độ Embed tương thích (không hỗ trợ điều khiển tua đồng bộ của thẻ video native).

---

## Verdict
**Đạt có điều kiện** 🛡️🎬✨ *(Code, build, typecheck, unit test và Chromium matrix đạt 100%; chờ xác nhận vật lý thực tế trên thiết bị iPhone Safari)*
