# Quy ước giao diện responsive của DlowPhim

Tài liệu này là hợp đồng giao diện cho các lần tối ưu tiếp theo. Mục tiêu quan trọng nhất: sửa mobile không được làm thay đổi bố cục, kích thước hoặc cơ chế điều khiển đã ổn định trên desktop.

## 1. Breakpoint chuẩn

- Mobile: `320px–767px` (CSS mặc định, không có prefix).
- Desktop/tablet ngang: từ `768px` trở lên (`md:`).
- Chỉ dùng `lg:` và `xl:` để tinh chỉnh desktop rộng, không dùng chúng để sửa lỗi mobile.
- Kích thước bắt buộc kiểm tra: `360`, `390`, `430/440`, `768`, `1024`, `1440` và `1920px`.
- Không viết giao diện chỉ đúng cho một máy cố định như `400px` hoặc `430px`.

## 2. Tách cấu trúc mobile và desktop

Khi mobile và desktop khác nhau về cấu trúc, phải dùng hai nhánh riêng:

```tsx
<div className="md:hidden">Giao diện mobile</div>
<div className="hidden md:block">Giao diện desktop</div>
```

- Không dùng JavaScript đo `window.innerWidth` chỉ để đổi bố cục.
- Không sửa DOM dùng chung nếu thay đổi đó làm desktop bị co, tràn hoặc đổi vị trí.
- Chỉ tái sử dụng các phần nhỏ không phụ thuộc bố cục: badge, nút, dữ liệu phim, formatter và xử lý ảnh lỗi.

## 3. Hợp đồng từng khu vực trang chủ

### Anime

- Desktop: một khung tối lớn gồm **hai tầng trong normal flow**.
  1. Tầng trên là nội dung bên trái và backdrop bên phải, có gradient mờ giao nhau.
  2. Tầng dưới là dải poster riêng, có đường phân cách phía trên.
- Poster desktop tuyệt đối không được `absolute` đè lên backdrop.
- Mobile dùng card/slider riêng và không được thay class của nhánh desktop.

### Phim sắp chiếu và phim chiếu rạp

- Mobile: cuộn ngang tự nhiên bằng cảm ứng, có snap và card hiển thị khoảng hai phim.
- Desktop: giữ kích thước card desktop, kéo chuột/nút điều hướng; tắt snap bằng `md:snap-none`.
- Không đưa chiều rộng card mobile vào class desktop và ngược lại.

### Top 10 và các hàng phim

- Mobile ưu tiên native horizontal scroll, vùng chạm tối thiểu `40px`.
- Desktop giữ carousel chuột/nút và khoảng cách hiện có.
- Badge dùng component chung; phần bố cục card có thể tách riêng cho hai breakpoint.

## 4. Quy ước carousel

- Container mobile: `overflow-x-auto`, `touch-pan-x`, snap hợp lý; không chặn `pointermove` mặc định nếu chưa thật sự cần.
- Container desktop: thêm `md:snap-none`; chỉ bật drag chuột trên desktop.
- Nút trái/phải không được thay đổi số lượng card visible khi chuyển breakpoint ngoài thiết kế.
- Khi bấm nút, dịch theo đúng một card nếu yêu cầu sản phẩm là đi từng phim.

## 5. Quy ước ảnh

- Backdrop dùng tỉ lệ ngang và `object-cover`; poster dùng tỉ lệ dọc.
- Giữ kích thước khung ổn định trước khi ảnh tải để tránh layout shift.
- Không hiện ảnh nguồn thấp rồi đổi sang TMDB sau 1–2 giây trên cùng slide; chỉ reveal ảnh cuối sau khi preload xong.
- Luôn có fallback nhưng fallback không được thay đổi kích thước card.

## 6. Checklist trước khi hoàn tất

- [ ] So sánh desktop trước và sau tại `1440px`.
- [ ] Kiểm tra mobile tại `360`, `390` và `430/440px`.
- [ ] Vuốt thật trên mobile cho mọi carousel đã sửa.
- [ ] Kéo chuột và bấm nút carousel trên desktop.
- [ ] Kiểm tra không có thanh cuộn ngang toàn trang.
- [ ] Kiểm tra tiêu đề dài có ellipsis/line-clamp và không đẩy vỡ card.
- [ ] Chạy production build.
- [ ] Chỉ kết luận hoàn tất sau khi desktop và mobile đều qua kiểm tra.

## 7. Nguyên tắc chống regression

Nếu yêu cầu chỉ nhắc tới mobile, mọi thay đổi layout phải nằm trong nhánh `md:hidden` hoặc class không prefix đi kèm class khôi phục rõ ràng từ `md:`. Nếu cần thay cấu trúc desktop, phải coi đó là một thay đổi riêng và kiểm tra lại bằng ảnh trước/sau.
