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
| Hồ sơ diễn viên | `app/dien-vien/[id]/page.tsx` | Cùng một cây responsive | Cùng một cây responsive | Đã xác minh production; một owner dữ liệu, không socket |

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

### Bình luận, đánh giá và avatar dùng chung

**Trạng thái: Đạt cho component dùng chung trên `/movie/[slug]` và `/watch/[slug]`.**

- `CommentRatingSection.tsx` tiếp tục là owner duy nhất của comments, ratings và socket phòng bình luận. Không tạo owner riêng cho mobile, desktop, trang chi tiết hoặc trang xem phim.
- Effect comments và ratings chờ `AuthContext` hoàn tất loading rồi mới tải. Dependency dùng `user?.id`, không dùng object `user`, nên login/logout/đổi tài khoản tải lại dữ liệu cá nhân hóa đúng một lần mà không chạy lại khi chỉ reference của cùng user thay đổi.
- Cleanup comments hủy request, timer, interval, visibility listener và socket cũ. Effect ratings vừa abort vừa có cờ request hiện hành, nên response của phiên auth cũ không thể ghi đè `userRating` hoặc điểm trung bình của phiên mới.
- Avatar user hiện hành, comment gốc và reply đều fallback về `/images/avatars/default.png`. Loop guard so sánh `src` hiện tại thay vì lưu cờ lâu dài trên DOM node, nên cùng một thẻ ảnh được React tái sử dụng vẫn fallback được cho URL mới mà không lặp khi chính fallback lỗi.
- JSX, class, kích thước avatar, ring admin và bố cục desktop/mobile không thay đổi.

Bằng chứng runtime ghi nhận ngày `2026-08-14`:

| Nhóm | Kết quả | Bằng chứng |
| --- | --- | --- |
| Route/breakpoint | Đạt | Cả `/movie/[slug]` và `/watch/[slug]` tại `390`, `767`, `768`, `1440px` đều có đúng 1 `CommentRatingSection`, không overflow ngang và không console error. |
| Initial auth loading | Đạt | Trong khi auth loading: 0 request comments, 0 request ratings. Sau auth ready, `/movie` phát đúng 1 comments + 1 ratings; `/watch` phát đúng 1 comments và 0 ratings vì chủ động dùng `showTabs={false}`. |
| Auth transition | Đạt | User A → User B không reload tạo delta đúng `+1` comments và `+1` ratings (tổng mỗi loại là 2). Kịch bản response User A bị delay kết thúc với `finalRenderedUserRating: 9` của User B và `staleOldResponseOverwroteState: false`. |
| Socket lifecycle | Đạt | Mỗi route/viewport có 1 socket active; auth transition và crossing `767/768` disconnect socket cũ trước khi kết nối socket mới; peak và final active socket đều bằng 1. |
| Avatar fallback | Đạt | Avatar user, comment gốc và reply bị ép 404 đều về asset cục bộ với `complete: true`, `naturalWidth: 120`, `broken: false`. Test tái sử dụng cùng DOM node cho URL lỗi thứ hai vẫn fallback thành công; 2 lần lỗi riêng tạo đúng 2 lượt tải fallback, không có vòng lặp. |
| Kiểm tra mã | Đạt | TypeScript thành công, 7/7 test episode/playback qua và production build hoàn tất; `/movie/[slug]` là `14.3 kB`, `/watch/[slug]` là `23.5 kB`. |

Giới hạn đo đạc: Playwright không bắt riêng telemetry `abort` ở thời điểm micro-task, nhưng cleanup source có cả `AbortController` và cờ vô hiệu hóa; delayed-response test chứng minh response cũ không ghi đè state mới. Test frontend hiện chưa có unit riêng cho component bình luận.

### Chi tiết phim `/movie/[slug]`

**Trạng thái: Đạt một phần trên mobile; desktop giữ nguyên giao diện và các hạng mục shared/desktop còn hoãn.**

Phạm vi Phase 1 đã hoàn thành:

- `MovieDetailClient.tsx` tiếp tục là owner duy nhất của dữ liệu phim. Dưới `768px` chỉ mount `MobileMovieDetail` được tải động; từ `768px` chỉ mount JSX desktop cũ. Không có hai cây chi tiết phim, hai comment section hoặc hai owner API cùng hoạt động.
- Credits chỉ tải khi tab Diễn viên được kích hoạt. Request có `AbortController` và cờ request hiện hành, nên đóng/mở lại tab không kẹt spinner, lỗi HTTP kết thúc loading và response của slug cũ không thể ghi diễn viên vào phim mới.
- Backdrop, poster, gallery và sticky-watch trên mobile có fallback runtime về `/images/movie-placeholder.svg`; ảnh diễn viên lỗi về `/images/avatars/default.png`. Handler chặn vòng lặp khi chính fallback lỗi.
- Modal playlist mobile khóa cuộn `body`, tự cuộn nội bộ, khôi phục overflow khi đóng/unmount và tự đóng khi slug thay đổi. Cache batch tập cũng được reset theo slug.
- JSX và class giao diện desktop không thay đổi trong Phase 1.

Bằng chứng runtime ghi nhận ngày `2026-08-14`:

| Nhóm | Kết quả | Bằng chứng |
| --- | --- | --- |
| Breakpoint/DOM | Đạt | `360`, `390`, `767px`: đúng 1 root mobile; `768`, `1024`, `1440px`: đúng 1 root desktop. Mỗi mốc có đúng 1 comment section. |
| Overflow/console | Đạt | Cả 6 breakpoint có `scrollWidth === clientWidth`, không có ảnh hỏng trong lượt matrix và không có console error. |
| Credits lifecycle | Đạt | Hủy rồi mở lại tạo request mới và hiển thị 14 diễn viên; HTTP 500 không kẹt spinner; đổi slug trong lúc request trễ không làm rò diễn viên phim cũ. |
| Fallback ảnh mobile | Đạt | Backdrop, poster, gallery và sticky poster lỗi đều tải SVG cục bộ (`naturalWidth: 300`); ảnh diễn viên lỗi tải avatar mặc định (`naturalWidth: 120`); tất cả có `complete: true`. |
| Modal playlist mobile | Đạt | Tại `390x844`, `body.style.overflow` đổi `"" → "hidden" → ""`; cuộn overlay không đổi `window.scrollY`; modal nằm trong viewport; đổi slug đóng modal và trả overflow. |
| API/socket | Đạt trong phạm vi Phase 1 | Credits vẫn lazy-load; chỉ một responsive view và một comment section được mount. Crossing `767/768` remount đúng view, không tạo hai owner đồng thời. |
| Kiểm tra mã | Đạt | `next build` thành công; `/movie/[slug]` có bundle `14.3 kB`; TypeScript thành công; 7/7 test episode/playback qua. |

Các hạng mục chưa cho phép nâng route lên **Đạt production hoàn toàn**:

- [x] Đồng bộ trạng thái comment/rating khi auth thay đổi mà không reload; đã kiểm chứng trên cả `/movie` và `/watch`.
- [x] Chuẩn hóa fallback avatar user/comment/reply trong component shared mà không đổi layout desktop/mobile.
- [ ] Bổ sung fallback ảnh cho nhánh desktop mà không làm thay đổi giao diện desktop.
- [ ] Bổ sung test trực tiếp cho route/modal/credits; 7 test hiện tại chỉ bao phủ tiện ích episode và playback.
- [ ] Kiểm tra bổ sung bằng bàn phím vật lý và Safari/iOS thật cho focus/scroll-lock của modal.

### Hồ sơ diễn viên `/dien-vien/[id]`

**Trạng thái: Đạt trên mobile và desktop.**

- `app/dien-vien/[id]/page.tsx` là owner duy nhất của dữ liệu hồ sơ và danh sách phim, gọi `GET /movies/people/:personId/movies?page=:page`. Route dùng một cây DOM responsive, không tách owner mobile/desktop và không mở Socket.IO.
- Effect tải dữ liệu có `AbortController`. Khi đổi nhanh từ ID `1244732` sang `18897`, request cũ bị hủy và kết quả cuối là “Thành Long”; response cũ không ghi đè state mới.
- `PersonMovieCard.tsx` chỉ gọi `GET /movies/resolved-detail/:slug` khi người dùng chọn một phim để dò bản phát; không tải resolution cho toàn bộ card lúc render.
- Avatar diễn viên lỗi chuyển về `/images/avatars/default.png`; poster phim lỗi chuyển về `/images/movie-placeholder.svg`. Cả hai handler so sánh nguồn hiện tại để không lặp khi chính fallback lỗi; không đổi JSX layout, class hoặc kích thước desktop/mobile.

Bằng chứng runtime ghi nhận ngày `2026-08-14`:

| Nhóm | Kết quả | Bằng chứng |
| --- | --- | --- |
| Breakpoint/DOM | Đạt | Baseline đã quét `360`, `390`, `440`, `767`, `768`, `1024`, `1440`, `1920px`; sau bản vá fallback kiểm tra lại `390`, `767`, `768`, `1440px`. Mỗi mốc có đúng 1 root view. |
| API/lifecycle | Đạt | Không có nhóm request trùng trong ma trận. Đổi ID nhanh không để response cũ ghi đè diễn viên mới; card chỉ resolve playback khi được chọn. |
| Overflow/console | Đạt | `scrollWidth === clientWidth`, không console error tại toàn bộ ma trận; không ghi nhận ảnh visible hỏng sau bản vá. |
| Ảnh fallback | Đạt | Avatar ép 404 tải `default.png` với `complete: true`, `naturalWidth: 2400`; poster ép 404 tải `movie-placeholder.svg` với `complete: true`, `naturalWidth: 100`. Mỗi fallback phát đúng 1 request, không có vòng lặp. |
| Socket | Đạt | `webSocketCount: 0` tại mọi viewport; route không đăng ký socket realtime. |
| Kiểm tra mã | Đạt | TypeScript thành công, 7/7 test episode/playback qua và production build hoàn tất. `git diff --check` không báo lỗi whitespace. |

Giới hạn kiểm thử: frontend hiện chưa có unit hoặc E2E test chuyên biệt cho route hồ sơ diễn viên; trạng thái **Đạt** dựa trên runtime matrix, thử nghiệm race/fallback có chủ đích và production build nêu trên.

### Danh mục phim bộ và phim lẻ `/phim-bo`, `/phim-le`

**Trạng thái: Đạt trên mobile và desktop.**

- `MovieCatalogPage` là data owner duy nhất cho danh sách, loading, error, filter và pagination; mỗi mount chỉ gọi một `GET /movies/catalog`. Hai route dùng chung controller, không mount hai view responsive và không mở WebSocket.
- `MovieCard` giữ nguyên thứ tự fallback ảnh nguồn → poster/thumb thay thế → `fetchMovieArtwork` → `/images/movie-placeholder.svg`. Phase 2 bổ sung nhánh cuối khi URL artwork bên ngoài tiếp tục lỗi và guard khi đã ở placeholder nội bộ; không đổi JSX, class, aspect ratio hay layout desktop/mobile.
- Forced-failure đã block toàn bộ ảnh ngoài origin và full-scroll lazy images: `/phim-bo` 20/20 card, `/phim-le` 24/24 card đều về placeholder tại `390`, `767`, `768`, `1440px`; broken/transparent/overflow đều bằng `0`, request placeholder hữu hạn.
- Normal-network tại `390` và `1440px` sau tải mới, full-scroll và reload: broken/transparent/resource/application-console error đều `0`; mỗi mount/reload đúng một catalog request, overflow `0`, WebSocket `0`.
- Mock 15 trang đã thao tác thật input jump `2`, back và forward; request cuối dùng `page=2` cho cả hai route. HTTP 500 hiển thị retry, click thật phát đúng request thứ hai và khôi phục card. Empty response kết thúc loading, hiện empty branch và có `0` card.
- Ba vòng Next navigation thật ghi nhận mỗi mount thêm đúng 4 `mousedown` + 4 `keydown`, mỗi unmount gỡ đúng 4; sau mỗi vòng active count ổn định, tổng remove `12` mỗi loại, không rò listener.
- TypeScript, 7/7 test episode/playback và production build đều thành công. Bằng chứng chi tiết: `.codex-logs/anti-handoffs/catalog-series-feature-phase2.runtime.json` và báo cáo Phase 2 cùng thư mục ignored.

Giới hạn kiểm thử: fallback hiện được chứng minh bằng Playwright runtime artifact nhưng chưa có E2E test tương ứng được commit vào repository.

### Trang xem phim `/watch/[slug]` — tối ưu giao diện mobile

**Trạng thái: Đạt production cho luồng dữ liệu/playback đã kiểm chứng; fullscreen native trên iPhone Safari đang chờ xác nhận lại bằng thiết bị thật sau bản vá ngày `2026-08-21`.**

- `/watch/[slug]` tiếp tục là data owner duy nhất của phim, nguồn phát, tập và trạng thái player; lượt tối ưu này không thêm API owner, socket hay component responsive thứ hai. Route chỉ có thêm một cặp listener trình duyệt `online/offline` ổn định và cleanup khi unmount.
- Mobile header và bottom navigation được khôi phục cho route `/watch`; các route toàn màn hình thật sự (`/watch-together/room`, `/watch-together/create`, admin) vẫn giữ chính sách ẩn navigation.
- Dưới `768px`, phần breadcrumb “Bạn đang xem” bị lặp được ẩn, tiêu đề player rút gọn một dòng, card thông tin phim chuyển thành bố cục ngang gọn và mô tả dài không lặp lại. `MovieReleaseStatus` đã được gỡ khỏi route ở cả mobile lẫn desktop, đồng thời loại bỏ request trì hoãn không còn cần thiết.
- Hàng hành động mobile dùng một hàng 5 hoặc 6 cột nhỏ gọn theo số nút; cụm nguồn dùng nhãn ngắn “Âm thanh” và “Máy chủ”. Player mobile ẩn rewind, fast-forward, PiP và duration dư thừa; volume slider cố định `42px`. Từ `768px`, toàn bộ control và kích thước desktop cũ được giữ lại.
- Plyr bật rõ `clickToPlay`; chạm vào vùng video chuyển `pause → play → pause`, trong khi thao tác menu cài đặt không đổi trạng thái phát. Menu tốc độ/chất lượng dùng nền tối, được nén còn tối đa `180px` trên mobile và nằm trên overlay tiêu đề để không che các lựa chọn đầu.
- Phim nhiều tập giữ nút “Danh sách tập”. Mobile dùng bottom sheet qua portal, còn desktop tiếp tục dùng side drawer cũ; cả hai dùng chung state và dữ liệu. Mobile chia tối đa 60 tập mỗi nhóm, nên phim 180 tập chỉ mount 60 nút tập thay vì toàn bộ danh sách.
- Effect tải phim chính có `AbortController` và cờ `disposed`; đổi slug hoặc unmount sẽ hủy toàn bộ chuỗi `check-blocked → nguồn chính → v1 → fallback → custom`, đồng thời response cũ không được ghi vào state của phim mới.
- Effect hợp nhất nguồn dự phòng chỉ chạy sau khi metadata phim chính sẵn sàng, có cleanup riêng và không còn phát request `resolved-detail` sớm rồi lặp lại khi `movie` được cập nhật.
- Player đợi `AuthContext.loading` kết thúc trước lần khởi tạo đầu tiên, nhưng không phụ thuộc toàn bộ object `user`; vì vậy auth ban đầu không tạo player anonymous rồi dựng lại, còn cập nhật `watchHistory` không làm HLS/Plyr bị remount.
- Listener `timeupdate`/`pause` đọc user và hàm cập nhật lịch sử hiện hành qua ref. Mỗi pending database sync đóng gói cố định `ownerId + token + historyItem`, nên logout/đổi tài khoản không thể gửi lịch sử của phiên cũ bằng token phiên mới. Listener `pagehide`/`visibilitychange` giữ ổn định và không còn tháo/lắp theo mỗi lần object user đổi.
- Endpoint cập nhật lịch sử dùng một MongoDB update pipeline nguyên tử, thay cho hai thao tác `$pull` rồi `$push`. Mỗi payload mang `updatedAt`; request cũ hoàn thành chậm không thể ghi đè tiến độ pause/pagehide mới hơn. Frontend chỉ xóa pending sync sau response thành công và giữ lại payload khi mạng lỗi để lượt lifecycle sau có thể thử lại.
- Cinema mode, mobile settings sheet và episode sheet dùng ba body class độc lập thay vì cùng ghi/khôi phục `body.style.overflow`; đóng một overlay không còn vô tình mở khóa hoặc khóa cứng cuộn khi overlay khác vẫn active.
- HLS fatal network error được phục hồi hữu hạn hai lần, sau đó chuyển sang embed khi không còn HLS phù hợp; state embed không bị effect chọn nguồn mặc định bật ngược lại nếu server/tập không đổi.
- Mất mạng cục bộ được tách khỏi lỗi CDN: HLS dừng tải và giữ player/tập/thời gian hiện hành, không gửi telemetry failure, không quarantine origin và không chuyển Embed. Khi trình duyệt phát sự kiện `online`, route chỉ tăng một recovery nonce để khởi tạo lại HLS đúng một lần; mở trang khi đang offline cũng chờ mạng thay vì tạo request phát vô ích.
- HLS runtime được nâng từ `1.4.12` lên stable `1.6.17`. Fatal media/decode error dùng chuỗi phục hồi hữu hạn: lần đầu rebuild MediaSource, lần hai đổi audio codec rồi rebuild; sau đó mới failover. Mỗi lần thay tập/nguồn hoặc unmount đều detach/destroy HLS và xóa `src` + gọi `load()` trên media element để không giữ audio decoder/buffer cũ — trường hợp có thể gây rè cho tới khi reload trang.
- Prefetch manifest tập kế tiếp dùng một `Set` khóa theo `server + tập + URL` trong suốt vòng đời route. Prefetch là tối ưu tùy chọn nên kể cả endpoint trả lỗi, cùng manifest không bị gọi lại ở mỗi `timeupdate`; đổi tập/nguồn vẫn tạo khóa riêng mà không ảnh hưởng player chính.
- Fullscreen mobile ưu tiên bộ điều khiển video native của iPhone (`webkitEnterFullscreen`/`webkitExitFullscreen`) thay vì buộc Plyr dùng full-window fallback. Sự kiện fullscreen chuẩn, WebKit và native video được đồng bộ vào một state; nếu WebKit vẫn phải fallback, class `dlowphim-player-fullscreen` ẩn Navbar mobile/desktop và Footer ngay cả khi xoay ngang làm chiều rộng vượt breakpoint `md`.

Bằng chứng runtime cập nhật ngày `2026-08-21`:

| Nhóm | Kết quả | Bằng chứng |
| --- | --- | --- |
| Breakpoint/navigation | Đạt | `360`, `390`, `430`, `767px`: đúng 1 mobile header + 1 bottom navigation; `768`, `1024`, `1440`, `1920px`: mobile navigation ẩn và desktop header hiện. |
| DOM/overflow | Đạt | Cả 8 breakpoint có đúng 1 `#watch-player-section`, phần Bình luận vẫn hiện, không ảnh hỏng và không overflow ngang. |
| Player controls | Đạt | Mobile: rewind/PiP ẩn, volume bằng `42px`, tap vùng video cho chuỗi `pause → play → pause`; menu tốc độ có đủ 6 lựa chọn nhìn thấy, đổi `1.25×` cập nhật playback rate; menu chất lượng đổi `1440p → Tự động` và phản ánh đúng nhãn. Desktop giữ bộ control cũ. |
| Nội dung mobile | Đạt | Không còn dòng “Bạn đang xem” bị lặp; trạng thái phát hành không còn ở cả hai giao diện. Action bar phim nhiều tập có 6 cột bằng nhau, cao khoảng `52.8px` tại `390px`, không overflow ngang. |
| Danh sách tập | Đạt | Bottom sheet tại `390px` rộng `380px`, cao tối đa `72dvh`, không overflow ngang. Phim 180 tập hiển thị các nhóm `1–60`, `61–120`, `121–180`; mỗi lần chỉ mount 60 nút, chọn Tập 61 đóng sheet và cập nhật URL đúng. |
| Chế độ rạp | Đạt | Bật chế độ rạp khóa cuộn body, player ở lớp `z-80` cao hơn bottom navigation `z-70`, không overflow; thoát chế độ rạp khôi phục overflow. |
| Fetch lifecycle/API | Đạt | Main fetch và fallback fetch đều abort/khóa response sau cleanup. Playwright production xác nhận một lượt điều hướng phát đúng `1` request `check-blocked` và đúng `1` request `resolved-detail`; test ghép nguồn/chọn tập và khôi phục lịch sử cùng pass. |
| Failover/mạng/auth history | Đạt | Failure injection phát đúng 3 lần `loadSource` (lần đầu + 2 recovery), sau đó giữ embed ổn định và không bật lại HLS. Mất mạng sau khi HLS đã chạy giữ `loadSource=1`, `stopLoad=1`, không telemetry failure/quarantine/Embed; khi online trở lại `loadSource` tăng đúng một lần lên `2`. Mở trang khi offline giữ `loadSource=0`, sau online tăng đúng một lần lên `1`. Media recovery có tối đa 2 bước, bước thứ hai gọi `swapAudioCodec` trước `recoverMediaError`; bước thứ ba bị từ chối để tránh loop. Đổi từ tập đang ở embed sang Tập 02 reset đúng về HLS mới và cập nhật URL. Auth `/me` bị trì hoãn chứng minh HLS init count giữ `0` khi auth đang tải và chỉ tăng sau khi owner hiện hành xác định. Pending history giữ token/owner tại thời điểm tạo; test xác nhận embed không gửi history trước khi auth sẵn sàng và hai sự kiện `pagehide` liên tiếp không nhân đôi request đang chạy. Backend có 3 test riêng cho atomic update, stale timestamp guard, chuẩn hóa progress và payload thiếu slug. |
| Offline breakpoint | Đạt | Trạng thái chờ mạng tại `390`, `767`, `768`, `1440px` luôn có đúng 1 `#dlow-hls-video`, 0 iframe Embed, không overflow ngang và không phát sinh lỗi hydration/update-loop/runtime nghiêm trọng. |
| Long-session soak | Đạt | Đồng hồ runtime tăng tốc mô phỏng 60 phút xem và 60 lần cập nhật tiến độ: xuyên suốt giữ đúng 1 HLS constructor, 1 `loadSource`, 1 Plyr và 1 video; số listener `keydown`, `online/offline`, `pagehide`, `visibilitychange` trước/sau bằng nhau. Database history không vượt quá 1 lần sync ban đầu + 1 lần/phút giả lập. Endpoint manifest tập kế tiếp bị ép `503` nhưng chỉ nhận 1 prefetch trong soak; đổi sang Tập 02 destroy HLS cũ đúng 1 lần rồi tạo đúng 1 owner mới. |
| Console/build | Đạt | Backend qua 22/22 suite, 112/112 test và Nest production build ở lượt audit trước. Lượt Task 3: frontend TypeScript thành công, 8/8 test episode/playback qua, 11/11 Playwright `/watch` chạy trên `next start` qua và production build hoàn tất; `/watch/[slug]` giữ `22.4 kB`, First Load JS `147 kB`. |

Giới hạn còn lại: Chromium không mô phỏng được native fullscreen của Safari iPhone. Bản vá iOS và Task 3 đã qua TypeScript, 8/8 test watch, 11/11 Playwright production và production build (`/watch/[slug]` `22.4 kB`, First Load JS `147 kB`), nhưng cần xác nhận một lượt trên iPhone thật rằng Safari chrome biến mất, video dùng native controls và xoay dọc/ngang không làm Navbar desktop xuất hiện. Long-session soak dùng đồng hồ tăng tốc và lifecycle có chủ đích, không thay thế phép đo bộ nhớ trên thiết bị thật sau nhiều giờ phát video/giải mã liên tục. `navigator.onLine` chỉ phản ánh trạng thái mạng do trình duyệt cung cấp; trường hợp thiết bị vẫn nối Wi-Fi nhưng Internet chết sẽ tiếp tục đi qua failover CDN hữu hạn hiện có. E2E hiện kiểm chứng auth-loading ban đầu và ownership token/pending; thao tác đăng nhập rồi đổi trực tiếp sang một tài khoản thứ hai trong cùng tab chưa có fixture UI chuyên biệt.

### Phòng xem chung `/watch-together/room/[roomId]`

**Trạng thái: Đạt production trong hợp đồng Embed mặc định; HLS là nguồn dự phòng.**

- `app/watch-together/room/[roomId]/page.tsx` tiếp tục là owner duy nhất của dữ liệu phòng, tập phim, chat, player và Socket.IO. Mobile chỉ tách `MobileRoomHeader` thuần trình bày; không tạo controller, request, iframe/video hoặc socket thứ hai.
- Nguồn phát ưu tiên `link_embed` ở đúng tập đang chọn và chỉ chuyển HLS khi tập đó không có Embed. Do iframe cross-origin không cho điều khiển thời gian phát từ trang cha, đồng bộ phòng, chat và đổi tập vẫn dùng chung socket hiện hành nhưng trang cha không giả lập đồng bộ play/pause/seek cho Embed.
- Effect tải phòng có `AbortController` cùng cờ `disposed` bao phủ room, access status, message history, nguồn chính/fallback và custom movie. Đổi room/unmount hủy chuỗi cũ và chặn response cũ ghi state mới.
- Socket không còn bị dựng lại khi `playerType`, trạng thái phòng hoặc mốc bắt đầu thay đổi. Callback/heartbeat đọc player và trạng thái bắt đầu qua ref; cleanup vẫn disconnect socket cũ trước khi owner effect thay đổi.
- Dưới `768px`, header phòng dùng bố cục riêng gọn, tên giới hạn hai dòng, mã phòng/copy và hành động host không ép vỡ hàng. Player và chat dùng khoảng cách nhỏ hơn; chat cao `clamp(360px, 52dvh, 460px)`, tự cuộn nội bộ và giữ ô nhập luôn trong card. Desktop từ `768px` tiếp tục dùng nguyên header và layout hai cột cũ.
- Avatar chat lỗi hoặc rỗng chuyển về `/images/avatars/default.png` với loop guard, không còn phụ thuộc ảnh mặc định bên ngoài.

Bằng chứng cập nhật ngày `2026-08-21`:

| Nhóm | Kết quả | Bằng chứng |
| --- | --- | --- |
| Breakpoint/overflow | Đạt | Runtime tại `360`, `430`, `767`, `768`, `1440px` đều có `scrollWidth === clientWidth` và không overflow ngang. `390x844` xác nhận header, player, chat và input nằm đúng luồng mobile. |
| Player ownership | Đạt | Mỗi breakpoint có đúng `1` iframe Embed và `0` video HLS cho phòng có cả nguồn Embed; chỉ một tiêu đề responsive có kích thước hiển thị tại mỗi phía `767/768`. |
| Desktop impact | Đạt | `1440x1000` giữ header desktop, player trái và chat phải; mobile header có kích thước bằng `0` và không ảnh hưởng layout desktop. |
| Lifecycle/socket | Đạt | Room fetch có abort/stale guard; socket effect không phụ thuộc các state player/phòng thường xuyên đổi. Backend room service/gateway có 19/19 test qua. |
| Kiểm tra mã | Đạt | Frontend TypeScript thành công, 8/8 test episode/playback qua; backend room tests 19/19 qua; frontend và backend production build hoàn tất. Lần kiểm tra gần nhất giữ route room ở `18.7 kB`, First Load JS `125 kB`. |

Giới hạn kỹ thuật: Embed cross-origin không thể cung cấp đồng bộ điều khiển phát chính xác như HLS. Cảnh báo trực quan đã được bỏ khỏi player để không che nội dung trên cả mobile và desktop; nếu một tập không có Embed, HLS fallback vẫn dùng cơ chế sync player hiện hành.
Fullscreen container của phòng đã đồng bộ cùng cơ chế ẩn app chrome khi Fullscreen API hoạt động. Trên iPhone, fullscreen của Embed vẫn do iframe/nhà cung cấp quyết định; cần kiểm tra thiết bị thật riêng và đây không thể được bảo đảm bằng API từ trang cha.

### Các route còn lại

Route `/watch/[slug]` đã đạt các kiểm tra production tự động sau failure injection, auth gating và kiểm tra hồi quy nêu trên; trạng thái cuối cho fullscreen iPhone vẫn chờ xác nhận thiết bị thật. Audit production riêng của `/phim-bo` và `/phim-le` đã hoàn tất trong Phase 2 nêu trên.
