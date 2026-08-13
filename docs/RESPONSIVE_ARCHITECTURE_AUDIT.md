# Kiểm kê kiến trúc responsive

Tài liệu này lưu **trạng thái đã kiểm chứng** của từng route. Quy tắc thực hiện nằm tại [`RESPONSIVE_UI_CONVENTIONS.md`](./RESPONSIVE_UI_CONVENTIONS.md). Khi tiếp tục tối ưu responsive phải đọc cả hai file: một file cho biết phải kiểm tra thế nào, file này cho biết phần nào đã đạt và phần nào chưa được phép kết luận.

## Trạng thái hiện tại

| Khu vực | Owner dữ liệu | Mobile độc lập | Desktop độc lập | Nguy cơ gọi trùng |
| --- | --- | --- | --- | --- |
| Trang chủ | `app/page.tsx` và các row dùng chung | Hero/Anime có nhánh mobile | Có nhánh desktop | Đã xác minh production; không có request trùng do responsive |
| Tìm kiếm | `app/search/page.tsx` | `MobileSearchBox` tải động và chỉ mount dưới `768px` | Navbar desktop | Đã xác minh production; page chỉ gọi danh sách một lần, gợi ý có cache/in-flight |
| Lịch chiếu | Page lịch chiếu | Bố cục responsive cùng dữ liệu | Bố cục responsive cùng dữ liệu | Thấp: không có hai owner dữ liệu |
| User | `AuthContext` và từng page `app/user/*` | Navigation/account view mobile chỉ mount dưới `768px` | Sidebar/form desktop chỉ mount từ `768px` | Đã xác minh production; một owner auth/state, summary/artwork có cache và in-flight |
| Chuông thông báo | `Navbar.tsx` | `MobileNotificationBell` | `DesktopNotificationBell` | Thấp: request chỉ chạy khi popup được mở |
| Chi tiết phim | `MovieDetailClient.tsx` | `MobileMovieDetail` tải động | JSX desktop cũ | Đã khóa: chỉ một view được mount |

## Quyết định kỹ thuật

Không tách request thành hai page mobile/desktop. Việc đó dễ tạo hai cache, hai loading state và hai socket. Thay vào đó, mỗi feature có một controller dùng chung và hai view thuần hiển thị. Chỉ feature nặng mới cần gate theo viewport để tránh mount đồng thời; markup nhỏ tiếp tục dùng CSS breakpoint để không tạo hydration flash không cần thiết.

## Phạm vi “desktop đóng băng”

Các file/component desktop không được sửa trong yêu cầu mobile. Nếu mobile cần cấu trúc khác, tạo file mới dưới thư mục `mobile` và truyền props từ controller. Không dùng selector CSS toàn cục để sửa một chi tiết mobile.

## Nhật ký xác minh theo route

Các trạng thái hợp lệ:

- **Đạt**: đã có đủ bằng chứng DOM, API, ảnh, socket, overflow, breakpoint và kiểm tra build/test theo quy ước.
- **Đạt một phần**: đã có bằng chứng cho một số nhóm nhưng vẫn còn mục chưa kiểm tra hoặc môi trường kiểm tra bị giới hạn.
- **Chưa kiểm tra**: mới đánh giá kiến trúc hoặc giao diện bằng mắt, chưa audit runtime.
- **Không đạt**: đã có bằng chứng lỗi hoặc dư thừa cần xử lý.

### Trang chủ `/`

**Trạng thái: Đạt cho trang chủ public và toàn bộ danh mục; nhánh “Xem tiếp” đăng nhập đạt một phần do phiên audit không có token người dùng.**

Phạm vi đã tối ưu:

- Hero mobile và desktop được gate theo viewport, không mount đồng thời hai nhánh nặng.
- Hero dùng cache phía client; backend giới hạn ứng viên và dừng khi đủ slide hợp lệ.
- Các khối dưới Hero dùng lazy mount theo thứ tự cuộn thay vì mount toàn bộ ngay lần tải đầu.
- Ảnh progressive theo dõi chính xác `src` đã load, tránh reload từ cache xong bị reset về `opacity: 0`.
- Placeholder mobile của Top 10, phim sắp chiếu và phim chiếu rạp có chiều cao riêng; desktop giữ giá trị cũ từ `md:`.
- Khoảng đệm `pt-20` bị cộng trùng dưới header của Hero mobile đã được loại bỏ.
- Request danh mục, Hero, system settings và artwork có cache/in-flight owner; remount không tạo request song song cùng URL.
- Effect của hàng quốc gia, Cinema và Anime có cleanup/abort; Anime khóa request chuẩn bị feature theo slug.
- Fallback ảnh dùng asset nội bộ `/images/movie-placeholder.svg`, không phụ thuộc thêm một CDN ngoài khi nguồn chính lỗi.
- Placeholder lazy được gỡ min-height sau khi nội dung thật có kích thước, nên vẫn chặn observer cascade nhưng không giữ vùng đen giả.

Bằng chứng runtime đã ghi nhận ngày `2026-08-11`:

| Nhóm | Kết quả | Bằng chứng |
| --- | --- | --- |
| DOM/lazy-load | Đạt | Tải đầu mobile có 253–661 node và 7–37 ảnh tùy chiều cao/tốc độ dữ liệu; chỉ sau khi cuộn hết trang mới đạt khoảng 1703 node và 107 ảnh. Tất cả danh mục đều mount thành công. |
| Mount responsive Hero | Đạt | `360–767px`: chỉ Hero mobile mount. Từ `768–1920px`: chỉ Hero desktop mount. Không có hai cây Hero cùng tồn tại. |
| Overflow toàn trang | Đạt | `scrollWidth === clientWidth` tại cả 8 mốc; độ lệch lớn nhất bằng `0`. |
| Khoảng cách section | Đạt | Top 10 → sắp chiếu và sắp chiếu → chiếu rạp là `40px` ở mobile nhỏ, `48px` từ `sm`/desktop; không còn min-height tạo vùng đen. |
| Ảnh tải mới | Đạt | Audit bằng môi trường truy cập được CDN không ghi nhận ảnh visible hỏng. Opacity `0` chỉ xuất hiện thoáng qua trong hiệu ứng fade 300ms, không tồn tại sau khi dừng hoặc reload. |
| Ảnh reload/cache | Đạt | Tất cả 8 mốc có `brokenViewportImages: []`, `transparentViewportImages: []` và overflow bằng `0` sau reload. |
| API trùng production | Đạt | Lượt audit production cuối tại cả 8 mốc có `duplicates: []`; các request Anime trùng ban đầu đã được khóa theo slug. |
| Console/runtime | Đạt | `consoleErrorCount: 0` tại cả 8 mốc. Các request `_rsc` báo `ERR_ABORTED` là prefetch Next.js bị hủy khi đóng/chuyển lượt audit, không phải lỗi API. |
| Socket public homepage | Đạt | Không có WebSocket được khởi tạo trên trang chủ public (`websockets: 0`), đúng vì trang không có feature realtime đang mở. |
| Breakpoint | Đạt | Đã audit production tại `360`, `390`, `440`, `767`, `768`, `1024`, `1440` và `1920px`. Ranh giới `767/768` đổi đúng một nhánh Hero. |
| “Xem tiếp” | Đạt một phần | Với lịch sử local giả lập, endpoint summary chỉ phát đúng 1 request, không overflow/ảnh hỏng. Endpoint yêu cầu đăng nhập nên chưa xác minh được card và thao tác xóa trong phiên audit không token. |
| Kiểm tra mã | Đạt | TypeScript thành công, 7/7 test frontend liên quan thành công và production build hoàn tất sau toàn bộ thay đổi. |

Việc còn lại không chặn trạng thái **Đạt** của trang chủ public:

- [ ] Khi có phiên đăng nhập dùng để test, xác minh card “Xem tiếp”, xóa một mục và listener/navbar sau khi chuyển route. Đây là kiểm tra cho nhánh cá nhân hóa, không phải các danh mục public.

### Tìm kiếm `/search`

**Trạng thái: Đạt cho tìm kiếm public trên mobile và desktop.**

Phạm vi đã tối ưu:

- `app/search/page.tsx` là owner duy nhất tải danh sách kết quả. `MobileSearchBox` chỉ tải gợi ý sau khi người dùng chạm/gõ và được dynamic import, chỉ mount ở `360–767px`; từ `768px` trở lên chỉ còn ô tìm kiếm desktop trong Navbar.
- Request phim dùng cache/in-flight của discovery. Request diễn viên có cache 2 phút, giới hạn 40 mục, khóa in-flight và timeout; đổi từ khóa/route có cleanup nên kết quả cũ không ghi đè kết quả mới.
- Debounce không còn chớp trạng thái “không tìm thấy” trước khi request bắt đầu và không tiếp tục hiển thị gợi ý của từ khóa cũ.
- Sau khi gợi ý đã tải, submit cùng từ khóa và focus lại dùng cache, không phát lại request phim/diễn viên.
- Poster gợi ý có fallback nội bộ; ảnh diễn viên lỗi trở về icon thay vì để ảnh vỡ. Danh sách kết quả tiếp tục dùng khung ảnh cố định và fallback chuẩn của `MovieCard`.
- Mobile dùng phân trang gọn `Trước – Trang x/y – Sau`, nên số trang lớn không thể đẩy rộng viewport. Desktop giữ nguyên phân trang và bố cục cũ.
- Có timeout và nút thử lại cho lỗi tải danh sách; tiêu đề danh mục đúng theo `type`; từ khóa dài được ngắt dòng mà không tạo overflow.
- Popup hover chỉ mount sau 800ms trên thiết bị có chuột fine pointer. Việc lướt chuột/cuộn qua card không còn chủ động mount preview ngay từ `mouseenter`; request preview bị hủy không tạo console error production.

Bằng chứng runtime production ghi nhận ngày `2026-08-11`:

| Nhóm | Kết quả | Bằng chứng |
| --- | --- | --- |
| Owner/DOM responsive | Đạt | `360`, `390`, `440`, `767px`: đúng 1 `MobileSearchBox`; `768`, `1024`, `1440`, `1920px`: `MobileSearchBox = 0`, chỉ còn ô Navbar desktop. Mỗi lượt có đúng 24 card cho từ khóa kiểm tra. |
| API ban đầu | Đạt | Cả 8 breakpoint có `duplicateInitialRequests: []`. Không có hai view responsive cùng gọi danh sách. |
| Gõ nhanh mobile | Đạt | Chuỗi `one piece` được nhập từng ký tự cách 40ms nhưng sau debounce chỉ có 1 request discovery phim và 1 request người; không gọi theo từng ký tự. |
| Submit/cache | Đạt | Submit cùng từ khóa có `submitRequests: []`; focus lại có `refocusRequests: []`. Desktop tại `1440px` có cùng kết quả: 2 request gợi ý cần thiết và 0 request lại khi submit. |
| Ảnh tải mới/reload | Đạt | Cả 8 breakpoint có `brokenImages: []` và `transparentImages: []` ở viewport trước và sau reload. Cuộn hết 24 card tại `390px` và `1440px` có 26/27 ảnh trong DOM, không ảnh vỡ hoặc ảnh đã tải còn opacity `0`. |
| Overflow | Đạt | `scrollWidth === clientWidth` ở cả 8 breakpoint, khi dropdown đang mở, sau reload, với từ khóa 160 ký tự và ở trang 2. |
| Phân trang/danh mục | Đạt | Mobile đổi sang `page=2` thành công; `/search`, `phim-chieu-rap`, `phim-sap-chieu` lần lượt hiện đúng tiêu đề và 24/24/12 card trong dữ liệu audit. |
| Socket/listener | Đạt | Production Search không mở WebSocket. Listener ngoài của ô mobile không tồn tại từ `768px` vì component không mount; listener trong component có cleanup. |
| Console/runtime | Đạt | Audit chính production ở cả 8 breakpoint có `errors: []` và `sockets: []`. |
| Kiểm tra mã | Đạt | TypeScript thành công, 7/7 test frontend liên quan thành công và production build hoàn tất sau thay đổi cuối. |

### Tài khoản `/user/*`

**Trạng thái: Đạt cho `/user/account`, `/user/favorite`, `/user/history`, `/user/watchlist` và `/user/notifications` trên mobile và desktop.**

Phạm vi đã tối ưu:

- `app/user/layout.tsx` vẫn là controller chung nhưng chỉ mount một navigation theo viewport: `MobileUserNavigation` dưới `768px`, sidebar desktop từ `768px`. Không còn hai cây avatar/menu cùng tồn tại và cùng tải tài nguyên.
- `/user/account` chỉ mount một form tài khoản theo viewport. File input upload được đặt ở owner chung để cả hai view dùng cùng handler; mobile không còn phụ thuộc vào input nằm trong cây desktop ẩn.
- Hook phân nhánh dùng cùng giá trị `window.innerWidth < 768` với breakpoint Tailwind. Lỗi vùng trống tại viewport CSS có phần thập phân quanh `767/768px` đã được loại bỏ.
- Favorite, History và Watchlist dùng chung `getUserMovieSummaries`; slug được loại trùng, cache 10 phút, khóa in-flight và chia batch tối đa 50 phim. Không tạo một request owner riêng cho mobile.
- Fallback artwork của Favorite, History và Watchlist đi qua cache/in-flight chung rồi về `/images/movie-placeholder.svg`; không gọi trực tiếp lặp lại endpoint logo và không phụ thuộc ảnh Unsplash khi nguồn chính lỗi.
- Phân trang tự kẹp lại trang hợp lệ sau khi xóa dữ liệu; mobile dùng biến thể gọn, desktop giữ bố cục cũ.
- Notifications khóa request đang bay theo trang và dùng request id để response cũ không ghi đè trang mới hoặc state sau unmount. Socket thông báo vẫn chỉ do `AuthContext` sở hữu một lần theo user và được gỡ listener/disconnect khi cleanup.
- Modal avatar và playlist có `role="dialog"`, nhãn tiêu đề và nút đóng có tên truy cập. Card playlist có nút mở riêng, dùng được bằng bàn phím mà không lồng các nút sửa/xóa sai ngữ nghĩa.
- Các route con trên mobile đều có nút “Quay lại trang tài khoản”; desktop tiếp tục dùng sidebar cũ và không nhận CSS vá toàn cục từ mobile.

Bằng chứng runtime production ghi nhận ngày `2026-08-12` với tài khoản đăng nhập thật:

| Nhóm | Kết quả | Bằng chứng |
| --- | --- | --- |
| Owner/DOM responsive | Đạt | `/user/account` mobile có 1 form nội dung hiển thị; desktop có form Navbar và đúng 1 form tài khoản. Mỗi viewport chỉ có một navigation user; không còn cây mobile và desktop mount đồng thời. |
| Ma trận route/breakpoint | Đạt | Đã quét 5 route tại `360`, `390`, `440`, `767`, `768`, `1024`, `1440`, `1920px` (40 tổ hợp); `issues: []`. |
| Ranh giới `767/768` | Đạt | `767px`: account có đúng 1 navigation mobile, các route con có đúng 1 nút quay lại và không có sidebar. `768px`: đúng 1 sidebar desktop, không có navigation/nút quay lại mobile; cả hai phía đều có nội dung. |
| Overflow/ảnh | Đạt | Cả 40 tổ hợp có overflow ngang bằng `0`, `brokenImages: 0`, `transparentImages: 0`. Chi tiết playlist có 2 phim cũng không ảnh vỡ hoặc tràn ngang. |
| Modal/tương tác không phá dữ liệu | Đạt | Modal avatar mobile hiển thị đủ 26 ảnh, 27 nút tính cả nút đóng, nằm trọn viewport và tự cuộn nội bộ. Modal tạo playlist focus đúng input, nằm trọn viewport; mở playlist “anime” tải đúng 2 card. |
| API/cache | Đạt | Auth/state có một owner; summary và artwork đều loại request trùng bằng cache/in-flight. Notifications dùng một request in-flight mỗi trang và chặn response cũ. Không có page mobile nào tự tạo owner API thứ hai. |
| Socket/listener | Đạt | Chỉ `AuthContext` khởi tạo namespace notifications theo `user.id`; cleanup gỡ toàn bộ listener và disconnect. Các view `user/*` không tự mở socket. |
| Trạng thái dữ liệu | Đạt | Favorite và Notifications được kiểm tra ở empty state; History có 4 mục; Watchlist có 2 danh sách và playlist có 2 phim. Không thực hiện thao tác xóa thật để bảo toàn dữ liệu người dùng; các handler backend không bị thay đổi trong lượt tối ưu này. |
| Console/build | Đạt | TypeScript thành công, 7/7 test frontend thành công, `next build` hoàn tất; toàn bộ route `user/*` được sinh thành công. |

Route `/user` tiếp tục chuyển hướng về `/user/account`. Route `/user/vip` hiện là route chuyển hướng cũ về trang chủ, không có giao diện user riêng để audit responsive.

### Chuông thông báo

**Trạng thái: Đạt trên mobile và desktop.**

- `Navbar.tsx` là owner duy nhất của dữ liệu xem nhanh và các handler đọc/chọn/xem tất cả; `MobileNotificationBell` và `DesktopNotificationBell` chỉ là hai view responsive dùng chung props.
- Mobile chỉ mount dưới `768px` và hiển thị bottom-sheet/popup portal riêng. Desktop mount từ `768px` và dùng popover riêng; tại mọi breakpoint chỉ có đúng một nút chuông hiển thị.
- Cụm tài khoản desktop xuất hiện từ `md`, còn các liên kết điều hướng rộng chỉ xuất hiện từ `lg`; cách tách này loại bỏ khoảng hở `768–1023px` mà không nhân đôi bell, API hoặc socket.
- Dữ liệu xem nhanh chỉ được yêu cầu khi popup mở. Socket thông báo tiếp tục do `AuthContext` sở hữu; hai view chuông không tự tạo socket.

Bằng chứng runtime ghi nhận ngày `2026-08-13` với tài khoản đăng nhập thật:

| Nhóm | Kết quả | Bằng chứng |
| --- | --- | --- |
| Breakpoint/DOM | Đạt | `390`, `767`, `768`, `1024`, `1440px`: mỗi mốc có đúng 1 nút “Mở thông báo gần đây”. Dưới `768px` mở đúng `aside`; từ `768px` mở đúng popover/dialog desktop. |
| Ranh giới `767/768` | Đạt | `767px`: chỉ navigation/bell mobile. `768px`: mobile unmount, sidebar và bell desktop hiện; không còn khoảng trống chuông tại `768–1023px`. |
| Overflow/console | Đạt | Popup mở ở cả 5 breakpoint có overflow ngang bằng `0` và không có console error. |
| Ownership/socket | Đạt | Một owner dữ liệu/handler trong Navbar; socket duy nhất ở `AuthContext`; không có socket trong hai bell view. |
| Tương tác | Đạt | Popup mobile có overlay/nút đóng; cả hai view hiển thị empty state và nút xem tất cả mà không điều hướng hoặc sửa dữ liệu trong lượt audit. |

### Lịch chiếu

**Trạng thái: Đạt trên mobile và desktop.**

- `ScheduleClient.tsx` là owner duy nhất của dữ liệu và trạng thái lịch chiếu ở client. Mobile và desktop dùng chung một cây DOM responsive; không mount hai view, không nhân đôi API hoặc socket.
- Tuần hiện tại luôn được tính từ Thứ Hai đến Chủ Nhật theo `Asia/Ho_Chi_Minh`; phép dịch ngày đã được kiểm tra cả trường hợp giao tháng và giao năm.
- Cache client theo ngày và `AbortController` ngăn request cũ ghi đè ngày được chọn cuối. Backend cache theo nguồn/ngày/limit trong 10 phút; cache miss ngày quá khứ hoặc hiện tại gọi 6 trang catalog, còn ngày tương lai gọi 1 request TMDB discover và `N` request detail với `0 <= N <= 20`.
- Poster có fallback tĩnh qua `getBestMovieImage` và fallback runtime qua `onError` sang `/images/movie-placeholder.svg`; handler có chặn lặp khi chính placeholder lỗi.

Bằng chứng runtime ghi nhận ngày `2026-08-13`:

| Nhóm | Kết quả | Bằng chứng |
| --- | --- | --- |
| Breakpoint/DOM | Đạt | `360`, `390`, `767`, `768`, `1024`, `1440px`: đúng một cây lịch chiếu; grid lần lượt chuyển `1/1/2/2/3/4` cột. |
| Tuần/timezone | Đạt | Đúng 7 ngày cố định Thứ Hai–Chủ Nhật theo giờ Việt Nam; ngày hiện tại và trạng thái chọn đúng, thuật toán xử lý giao tháng/năm. |
| Overflow | Đạt | `scrollWidth === clientWidth` ở cả 6 breakpoint. Thanh ngày chỉ cuộn ngang trong container tại màn hình hẹp và không gây tràn toàn trang. |
| API/cache/lifecycle | Đạt | Ngày chưa cache phát đúng 1 request `/movies/showtimes`; quay lại ngày đã tải không gọi lại API. Click nhanh 7 ngày hủy request cũ và chỉ dữ liệu ngày cuối được hiển thị. |
| Ảnh | Đạt | URL poster hợp lệ nhưng trả 404 được đổi sang SVG cục bộ; placeholder tải thành công với `naturalWidth > 0`, không còn broken image và không phát sinh request showtimes mới. |
| Socket/listener | Đạt | Không mở WebSocket và không tạo resize listener. Responsive dùng CSS breakpoint; `scrollIntoView` chỉ chạy khi `selectedDate` đổi. |
| Console/build | Đạt | Không có lỗi console hoặc hydration trong matrix runtime. TypeScript frontend thành công, 7/7 test utility frontend qua, 12/12 test `movies-catalog.spec.ts` backend qua, frontend và backend production build thành công. Route `/lich-chieu` sinh tĩnh ở `4.62 kB`. |

Giới hạn kiểm thử: 7 test frontend hiện tại chỉ bao phủ tiện ích episode/playback, chưa có unit hoặc E2E test trực tiếp cho `ScheduleClient`; trạng thái **Đạt** dựa trên runtime matrix, backend catalog tests và production build nêu trên.

### Các route còn lại

Chi tiết phim hiện mới có kiểm kê kiến trúc ở bảng đầu tài liệu và chưa được đánh dấu **Đạt** cho đến khi có nhật ký runtime theo sáu nhóm bắt buộc trong tài liệu quy ước.
