# Kiểm kê kiến trúc responsive

Tài liệu này lưu **trạng thái đã kiểm chứng** của từng route. Quy tắc thực hiện nằm tại [`RESPONSIVE_UI_CONVENTIONS.md`](./RESPONSIVE_UI_CONVENTIONS.md). Khi tiếp tục tối ưu responsive phải đọc cả hai file: một file cho biết phải kiểm tra thế nào, file này cho biết phần nào đã đạt và phần nào chưa được phép kết luận.

## Trạng thái hiện tại

| Khu vực | Owner dữ liệu | Mobile độc lập | Desktop độc lập | Nguy cơ gọi trùng |
| --- | --- | --- | --- | --- |
| Trang chủ | `app/page.tsx` và các row dùng chung | Hero/Anime có nhánh mobile | Có nhánh desktop | Đã xác minh production; không có request trùng do responsive |
| Tìm kiếm | `app/search/page.tsx` | `MobileSearchBox` tải động và chỉ mount dưới `768px` | Navbar desktop | Đã xác minh production; page chỉ gọi danh sách một lần, gợi ý có cache/in-flight |
| Lịch chiếu | Page lịch chiếu | Bố cục responsive cùng dữ liệu | Bố cục responsive cùng dữ liệu | Thấp: không có hai owner dữ liệu |
| User | `app/user/layout.tsx` và từng page | `components/user/mobile/*` | Sidebar/form desktop | Thấp: view nhận chung auth/state |
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

### Các route còn lại

Lịch chiếu, `user/*`, chuông thông báo và chi tiết phim hiện mới có kiểm kê kiến trúc ở bảng đầu tài liệu. Chưa route nào trong nhóm này được đánh dấu **Đạt** cho đến khi có nhật ký runtime theo sáu nhóm bắt buộc trong tài liệu quy ước.
