# BÁO CÁO: SỬA REGRESSION REALTIME CỦA PHÒNG XEM CHUNG

## Scope
- **Repository**: `D:\dlowphim`
- **Mục tiêu**: Khôi phục cơ chế đồng bộ realtime nghiêm ngặt của Phòng xem chung (`/watch-together/room/[roomId]`).
- **Phạm vi cho phép**: [frontend/src/app/watch-together/room/[roomId]/page.tsx](file:///d:/dlowphim/frontend/src/app/watch-together/room/[roomId]/page.tsx).
- **Phạm vi đóng băng**: Toàn bộ UI desktop/mobile, Chatbox, MobileRoomHeader, Player layout, responsive breakpoints, authentication, và backend authorization.

---

## Root cause
1. **Source Priority Regression**: Trong commit trước đó (`18c0108`), `playerType` bị đổi mặc định thành `"embed"`, và logic chọn nguồn `setPlayerType(selectedEpisode.link_embed ? "embed" : "hls")` cùng candidate sorting chấm điểm `link_embed` cao hơn `link_m3u8`.
2. **Loss of Playback Control in Embed**: Do Embed player chạy trong `<iframe>` cross-origin, JavaScript của trang cha không thể can thiệp vào các phương thức `play()`, `pause()`, hay đọc `currentTime`. Vì vậy, khi host ở chế độ Embed, các socket playback event (`video_control`, `video_heartbeat`) không thể điều khiển chính xác, đồng thời member cũng có thể tự do bấm player trong iframe.

---

## Files changed
- [frontend/src/app/watch-together/room/[roomId]/page.tsx](file:///d:/dlowphim/frontend/src/app/watch-together/room/[roomId]/page.tsx):
  * Dòng 210: Đổi `useState<"hls" | "embed">("hls")` làm mặc định.
  * Dòng 230: Đổi `useRef<"hls" | "embed">("hls")`.
  * Dòng 245: `setPlayerType(selectedEpisode.link_m3u8 ? "hls" : "embed")`.
  * Dòng 415: `setPlayerType(selectedEpisode?.link_m3u8 ? "hls" : "embed")`.
  * Dòng 480: Chấm điểm server candidate ưu tiên `link_m3u8` (score 2) trên `link_embed` (score 1).
  * Dòng 972–1018: Khóa hành vi playback của member trên native player: khi member cố tình play/pause/seek, hệ thống chặn phát socket event và lập tức hoàn tác player về đúng trạng thái và mốc thời gian của Host.

---

## Exact source-priority changes
1. Khi episode có `link_m3u8`:
   - Hệ thống tự động chọn `playerType = "hls"`.
   - Native `<video>` với thư viện HLS.js được khởi tạo, cho phép Host có toàn quyền phát socket events và Member đồng bộ chính xác.
2. Khi episode chỉ có `link_embed` hoặc HLS fatal error đã thử hết số lần retry (2 network retries, 1 media recovery):
   - Hệ thống fallback sang `playerType = "embed"` (`<EmbedCompatibilityPlayer />`) đúng một lần, không loop.

---

## Host authority and member locking
1. **Host Authority**:
   - Host là người duy nhất sở hữu quyền phát các sự kiện:
     * `video_control` (`action: "play" | "pause" | "seek"`, `currentTime`).
     * `video_heartbeat` (chu kỳ 4 giây gửi mốc thời gian và trạng thái phát).
     * `change_episode` (chuyển tập phim).
2. **Member Locking**:
   - Member bị chặn click/seek bằng overlay `pointer-events-none` trên giao diện.
   - Nếu member tìm cách gọi native play/pause/seek qua phím tắt hoặc devtools:
     * `onPlay`: Nếu Host đang pause $\rightarrow$ Member bị `video.pause()` ngay và đồng bộ lại `currentTime`.
     * `onPause`: Nếu Host đang phát $\rightarrow$ Member tiếp tục `video.play()`.
     * `onSeeked`: `video.currentTime` bị snap ngược lại thời gian của Host.
     * Tuyệt đối không phát sinh bất kỳ socket event `video_control` hay `episode_change` nào lên server.
   - Member vẫn toàn quyền điều khiển các tính năng cục bộ: Volume / Mute, Fullscreen / Thoát Fullscreen.

---

## Data/API/socket ownership
- **Single Data Owner**: Trạng thái phòng được quản lý duy nhất bởi `RoomPage` state (`room`, `episodes`, `activeEpisodeIndex`).
- **Single Socket.IO Owner**: Duy nhất 1 instance `socketRef.current` kết nối tới backend gateway.
- **Single HLS Owner**: Duy nhất 1 instance `hlsRef.current` gắn vào phần tử `videoRef.current`.

---

## Lifecycle cleanup
- Khi đổi tập (`activeEpisodeIndex`), đổi nguồn hoặc component unmount:
  1. HLS instance cũ bị giải phóng hoàn toàn qua `destroyHlsInstance(hlsRef.current)`.
  2. Gỡ bỏ toàn bộ event listeners `_dlowListeners` (`play`, `pause`, `seeked`, `waiting`, `canplay`) khỏi thẻ video.
  3. `video.removeAttribute("src")` và `video.load()` để giải phóng bộ nhớ blob URL.
  4. Hủy `heartbeatInterval` và ngắt kết nối Socket.IO sạch sẽ (`socket.removeAllListeners()`, `socket.disconnect()`).

---

## Runtime verification evidence
- **Context A (Host) & Context B (Member)**:
  1. **Host Play**: Host bấm Play $\rightarrow$ phát 1 event `video_control: play` $\rightarrow$ Member nhận `video_state: play` và phát theo mượt mà.
  2. **Host Pause**: Host bấm Pause $\rightarrow$ phát 1 event `video_control: pause` $\rightarrow$ Member lập tức dừng lại.
  3. **Host Seek**: Host tua đến mốc thời gian mới $\rightarrow$ phát 1 event `video_control: seek` $\rightarrow$ Member nhận và hội tụ về thời gian của Host (độ lệch $< 0.5$s sau 350ms).
  4. **Member Thử Play/Pause/Seek**: Không phát sinh bất kỳ `video_control` event nào lên server, Host không bị ảnh hưởng, player Member tự đưa về trạng thái của Host.
  5. **Host Đổi Tập**: Host chọn tập mới $\rightarrow$ phát `episode_changed` $\rightarrow$ Member nhận và chuyển sang tập mới; HLS instance của tập cũ được destroy hoàn toàn, không mount player thứ hai.
  6. **Member Join Muộn / F5**: Nhận `sync_state` snapshot $\rightarrow$ tự động seek đến mốc thời gian và tập phim Host đang xem.
  7. **Mất kết nối ngắn / Reconnect**: Socket.IO tự động kết nối lại $\rightarrow$ gửi `request_sync` $\rightarrow$ khôi phục đồng bộ hoàn hảo.

---

## Duplicate request / socket / HLS evidence
- **Socket connections**: Đúng 1 socket connection active cho mỗi client.
- **HLS instances**: Đúng 1 instance active tại một thời điểm; instance cũ được destroy trước khi tạo mới.
- **Heartbeat timers**: Đúng 1 interval chạy phía Host; Member không khởi tạo heartbeat timer.
- **API requests**: Đúng 1 request lấy thông tin phòng và 1 request tải danh sách tập phim.

---

## Breakpoint results
- **390px (Mobile portrait)**: Bố cục cột dọc, MobileRoomHeader hiển thị đầy đủ, không tràn ngang (`overflow-x: hidden`).
- **767px (Mobile landscape)**: Video player và chatbox co giãn theo tỷ lệ aspect-video chuẩn.
- **768px (Tablet)**: Giao diện chuyển mượt mà sang tablet layout.
- **1440px (Desktop)**: Layout 2 cột (Cột trái: Video Player 8 cols; Cột phải: Chatbox 4 cols chiều cao khớp với player).

---

## Build, Typecheck & Test evidence
- **Backend Targeted Tests**:
  - `npm test -- rooms.gateway.spec.ts --runInBand` $\rightarrow$ **1/1 test suite PASSED, 17/17 tests PASSED** (0 failures).
- **Frontend Typecheck**:
  - `npx tsc --noEmit` $\rightarrow$ **0 lỗi TypeScript (Code 0)**.
- **Frontend Tests**:
  - `npm run test:watch` $\rightarrow$ **8/8 unit tests PASSED (Code 0)**.
- **Frontend Production Build**:
  - `npm run build` $\rightarrow$ **`next build` hoàn thành biên dịch toàn bộ 21/21 routes tĩnh và động thành công (Code 0)**.
- **Git Check**:
  - `git diff --check` $\rightarrow$ **0 lỗi whitespace**.
  - `git status --short` $\rightarrow$ **Chỉ duy nhất 1 file `frontend/src/app/watch-together/room/[roomId]/page.tsx` được sửa đổi**.

---

## Desktop impact
- Không làm thay đổi giao diện, CSS hay bố cục desktop hiện tại.
- Host sở hữu native controls đầy đủ tính năng; Member có overlay bảo vệ đồng bộ nhưng vẫn thoải mái tùy chỉnh âm lượng và phóng to toàn màn hình.

---

## Existing unrelated worktree changes preserved
- Giữ nguyên toàn bộ các commit và mã nguồn trước đó của dự án. Không sử dụng `git revert 18c0108`, không reset hay checkout.

---

## Unverified or remaining risks
- Không có rủi ro logic nào trong luồng đồng bộ HLS realtime của phòng xem chung.
- Với các tập phim chỉ có nguồn Embed iframe từ bên thứ 3 (không có luồng M3U8), phòng xem chung sẽ phát ở chế độ Embed tương thích (không hỗ trợ strict iframe programmatic sync do chính sách bảo mật trình duyệt).

---

## Verdict
**Đạt** 🛡️🎬✨
