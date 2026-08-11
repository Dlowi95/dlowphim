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
