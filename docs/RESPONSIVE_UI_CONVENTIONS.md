# Quy ước giao diện responsive của DlowPhim

Tài liệu này là hợp đồng chống regression. Mục tiêu quan trọng nhất: sửa mobile không được làm thay đổi bố cục, kích thước hoặc cơ chế điều khiển đã ổn định trên desktop.

## 1. Breakpoint chuẩn

- Mobile: `320px–767px`.
- Desktop/tablet ngang: từ `768px` trở lên (`md:`).
- Chỉ dùng `lg:` và `xl:` để tinh chỉnh desktop rộng.
- Bắt buộc kiểm tra: `360`, `390`, `430/440`, `768`, `1024`, `1440` và `1920px`.
- Không tối ưu riêng cho một thiết bị cố định.

## 2. Kiến trúc bắt buộc

Khi mobile và desktop khác nhau về cấu trúc, phải tách thành component/file riêng. Tên khuyến nghị:

```text
FeatureController.tsx       dữ liệu, state và handler dùng chung
DesktopFeatureView.tsx      giao diện desktop đang ổn định
mobile/MobileFeatureView.tsx giao diện mobile độc lập
```

- Controller là nơi duy nhất gọi API, giữ state nghiệp vụ và tạo handler.
- View chỉ nhận dữ liệu/callback qua props; không tự gọi lại cùng API.
- Không sao chép logic yêu thích, danh sách, lịch sử, đánh giá hoặc bình luận sang hai view.
- Khi một view có ảnh ưu tiên, socket, timer, observer hoặc effect nặng, **chỉ được mount một view theo breakpoint**. Không dùng `hidden` để che một cây React vẫn đang hoạt động.
- `matchMedia` chỉ được dùng tại ranh giới mount của hai view độc lập. Không dùng JavaScript để tinh chỉnh khoảng cách, cỡ chữ hoặc bố cục nhỏ.
- View mobile lớn phải được `dynamic import`; desktop không tải chunk mobile khi không sử dụng.
- Nhánh desktop cũ được coi là “đóng băng”. Một yêu cầu chỉ sửa mobile không được sửa JSX/class của nhánh desktop.

Với markup nhỏ, không có effect/API/socket/ảnh ưu tiên, có thể dùng CSS thuần:

```tsx
<div className="md:hidden">Mobile nhỏ, thuần hiển thị</div>
<div className="hidden md:block">Desktop nhỏ, thuần hiển thị</div>
```

## 3. Hợp đồng dữ liệu và hiệu năng

- Mỗi tài nguyên chỉ có một owner tải dữ liệu.
- Bình luận chỉ tạo một component/socket ở mọi thời điểm.
- Credits, gallery và đề xuất chỉ tải khi người dùng mở tab tương ứng; mở lại tab không gọi lại nếu dữ liệu đã có.
- Request phải có cleanup/abort khi đổi route. Không thêm state loading vào dependency nếu chính effect đó thay đổi state loading.
- Không preload ảnh của nhánh giao diện đang không được mount.
- Dùng khung ảnh ổn định để tránh layout shift; backdrop ngang, poster dọc và luôn có fallback cùng kích thước.

## 4. Hợp đồng từng khu vực

### Trang chủ

- Anime mobile dùng card/slider riêng; desktop giữ khung hai tầng và dải poster trong normal flow.
- Phim sắp chiếu, phim chiếu rạp và Top 10 trên mobile ưu tiên native horizontal scroll, touch và snap.
- Desktop giữ carousel chuột/nút hiện có. Không đưa chiều rộng card mobile vào class desktop.

### Tìm kiếm

- Desktop giữ ô tìm kiếm và gợi ý trong navbar.
- Mobile dùng `MobileSearchBox`; kết quả tìm kiếm và request danh sách vẫn do page/controller dùng chung quản lý.
- Không để hai ô tìm kiếm cùng phát request cho một thao tác người dùng.

### User và thông báo

- Component mobile nằm trong `components/user/mobile` hoặc file có tiền tố `Mobile`.
- Desktop sidebar/form giữ nguyên component desktop.
- Chuông mobile và desktop có view riêng nhưng dùng cùng dữ liệu/handler từ navbar; chỉ tải thông báo khi mở popup.
- Toast mobile phải nằm trong nhánh `md:hidden`; toast desktop không nhận class vị trí của mobile.

### Chi tiết phim

- `MovieDetailClient` là controller duy nhất.
- `MobileMovieDetail` là chunk mobile độc lập và chỉ được mount dưới `768px`.
- Desktop dùng nguyên nhánh JSX cũ và không được mount trên mobile.
- Bình luận luôn xuất hiện một lần; tab diễn viên/ảnh/đề xuất không được làm mất bình luận.

## 5. Carousel và thao tác chạm

- Mobile: `overflow-x-auto`, `touch-pan-x`, vùng chạm tối thiểu `40px`, snap khi phù hợp.
- Không chặn `pointermove` nếu không thật sự cần.
- Desktop: drag chuột/nút điều hướng; dùng `md:snap-none` nếu chung container.
- Nút điều hướng dịch đúng một card khi yêu cầu sản phẩm là đi từng phim.

## 6. Checklist bắt buộc trước khi hoàn tất

- [ ] So sánh desktop trước/sau tại `1440px` và `1920px`.
- [ ] Kiểm tra mobile tại `360`, `390` và `430/440px`.
- [ ] Kiểm tra mốc biên `767px` và `768px`.
- [ ] Không có thanh cuộn ngang toàn trang.
- [ ] Tiêu đề dài có ellipsis/line-clamp và không đẩy vỡ card.
- [ ] DOM chỉ có một view đối với feature nặng.
- [ ] Network không có request API trùng do hai view.
- [ ] Chỉ có một kết nối/socket bình luận.
- [ ] Mở lại tab lazy không gọi lại request đã tải thành công.
- [ ] Chạy TypeScript, test liên quan và production build.
- [ ] Chỉ kết luận hoàn tất sau khi desktop lẫn mobile đều qua kiểm tra.

## 7. Nguyên tắc chống regression

Nếu yêu cầu chỉ nhắc tới mobile, mọi thay đổi layout phải nằm trong file/component mobile hoặc class mobile có class khôi phục rõ ràng từ `md:`. Nếu cần thay cấu trúc desktop, coi đó là thay đổi riêng, xin đúng phạm vi và kiểm tra ảnh trước/sau.

## 8. Quy trình xác minh bắt buộc theo từng route

Không được kết luận một route đã tối ưu chỉ vì giao diện nhìn đẹp trong một ảnh chụp. Với **mỗi route được sửa**, phải kiểm tra bằng bằng chứng ở sáu nhóm sau:

### DOM và vòng đời component

- Đếm và đối chiếu cây DOM trước/sau khi tải dữ liệu, chuyển tab và cuộn lazy-load.
- Feature nặng chỉ được mount đúng một view tại breakpoint hiện tại; mobile không giữ ngầm cây desktop và ngược lại.
- Component đã rời viewport hoặc đổi route phải cleanup observer, timer, listener và effect.
- Placeholder lazy-load phải giữ bố cục khi chưa mount, nhưng không được tiếp tục tạo khoảng trống sau khi nội dung thật đã xuất hiện.

### API và dữ liệu

- Ghi lại toàn bộ request `fetch`/XHR khi mở route, thao tác chính, chuyển tab và quay lại tab.
- Nhóm request theo method + URL + payload để phát hiện request trùng thật sự; không chỉ nhìn tổng số request.
- Mobile và desktop dùng chung controller/data owner, trừ khi nghiệp vụ bắt buộc tách nguồn dữ liệu.
- Cache chỉ được coi là tối ưu khi dữ liệu cũ vẫn hiển thị an toàn, có thời hạn rõ ràng và refresh nền không tạo request lặp.

### Ảnh và tài nguyên

- Kiểm tra ảnh trong viewport: `complete`, `naturalWidth`, opacity và fallback sau khi tải mới lẫn reload từ cache.
- Ảnh ưu tiên chỉ dành cho nội dung above-the-fold; ảnh ngoài viewport phải lazy-load.
- Không tải đồng thời poster/backdrop của view đang không được mount.
- Mỗi khung ảnh phải có tỷ lệ cố định để tránh layout shift; lỗi ảnh không được để khung trắng, mất ảnh hoặc giữ `opacity: 0`.

### Socket, listener và kết nối thời gian thực

- Kiểm tra số kết nối WebSocket/Socket.IO thực tế của route.
- Một tính năng chỉ được sở hữu một socket; hai view responsive không được tạo hai kết nối cho cùng dữ liệu.
- Đổi route, đóng popup hoặc unmount phải gỡ listener; không được tăng số lần nhận event sau mỗi lần mở lại.

### Overflow và tương tác

- So sánh `documentElement.scrollWidth` với `clientWidth`; toàn trang không được overflow ngang.
- Chỉ carousel được phép overflow trong container riêng và phải thao tác được bằng touch.
- Kiểm tra nội dung dài, bàn phím mobile, modal/bottom sheet, safe-area và thanh điều hướng cố định.
- Không có phần tử fixed che nút hành động, toast, nội dung cuối trang hoặc vùng cuộn.

### Breakpoint và chống regression desktop

- Kiểm tra tối thiểu `360`, `390`, `430/440`, `767`, `768`, `1024`, `1440` và `1920px` khi thay đổi có phạm vi toàn layout.
- Tại `767/768px`, xác nhận chỉ một nhánh responsive được mount và không nháy hai giao diện khi hydrate.
- Chụp hoặc đo bố cục desktop trước/sau. Yêu cầu chỉ sửa mobile phải chứng minh desktop không đổi.
- Class mobile thay đổi giá trị dùng chung phải có giá trị khôi phục rõ ràng từ `md:`; nếu không bảo đảm được thì tách component/file mobile.

### Điều kiện được phép kết luận “đã tối ưu”

Chỉ được báo hoàn tất khi có đủ các bằng chứng sau:

- [ ] Không có DOM/view nặng mount trùng.
- [ ] Không có API trùng do responsive hoặc effect sai dependency.
- [ ] Không có ảnh visible bị lỗi, kẹt loading hoặc `opacity: 0` sau reload.
- [ ] Không có socket/listener bị nhân đôi hoặc rò rỉ.
- [ ] Không có overflow ngang toàn trang và không có fixed element che nội dung.
- [ ] Mobile qua các breakpoint yêu cầu và desktop giữ nguyên.
- [ ] TypeScript, test liên quan và production build đều thành công.

Nếu chưa kiểm tra đủ một mục, phải nói rõ đó là phần **chưa được xác minh**, không được suy luận là đã tối ưu.

## 9. Tiêu chí riêng cho trang chủ

- Hero mobile và desktop chỉ mount một nhánh theo breakpoint; chỉ ảnh Hero đang hoạt động được đặt ưu tiên cao.
- Các khối `chủ đề`, `xem tiếp`, `phim theo quốc gia`, `Top 10`, `phim sắp chiếu`, `phim chiếu rạp`, `anime` và `phim mới cập nhật` phải tải theo thứ tự khi người dùng cuộn.
- Placeholder của mỗi khối phải ngăn observer kích hoạt dây chuyền nhưng không được tạo padding/khoảng đen sau khi nội dung thật xuất hiện.
- Reload từ cache phải giữ ảnh Hero và các hàng phim hiển thị; không được reset trạng thái loaded sau sự kiện `load`.
- Request Hero được cache và giới hạn số ứng viên; không gọi chi tiết/TMDB cho toàn bộ danh sách nếu đã đủ số slide hợp lệ.
- Chỉ kết luận trang chủ mobile tối ưu sau khi đo cả lần tải mới, reload có cache và cuộn hết trang.
