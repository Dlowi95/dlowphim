# Kiểm kê kiến trúc responsive

## Trạng thái hiện tại

| Khu vực | Owner dữ liệu | Mobile độc lập | Desktop độc lập | Nguy cơ gọi trùng |
| --- | --- | --- | --- | --- |
| Trang chủ | `app/page.tsx` và các row dùng chung | Hero/Anime có nhánh mobile | Có nhánh desktop | Thấp: dữ liệu nằm ở owner chung |
| Tìm kiếm | `app/search/page.tsx` | `MobileSearchBox` | Navbar desktop | Thấp: page chỉ gọi request kết quả một lần |
| Lịch chiếu | Page lịch chiếu | Bố cục responsive cùng dữ liệu | Bố cục responsive cùng dữ liệu | Thấp: không có hai owner dữ liệu |
| User | `app/user/layout.tsx` và từng page | `components/user/mobile/*` | Sidebar/form desktop | Thấp: view nhận chung auth/state |
| Chuông thông báo | `Navbar.tsx` | `MobileNotificationBell` | `DesktopNotificationBell` | Thấp: request chỉ chạy khi popup được mở |
| Chi tiết phim | `MovieDetailClient.tsx` | `MobileMovieDetail` tải động | JSX desktop cũ | Đã khóa: chỉ một view được mount |

## Quyết định kỹ thuật

Không tách request thành hai page mobile/desktop. Việc đó dễ tạo hai cache, hai loading state và hai socket. Thay vào đó, mỗi feature có một controller dùng chung và hai view thuần hiển thị. Chỉ feature nặng mới cần gate theo viewport để tránh mount đồng thời; markup nhỏ tiếp tục dùng CSS breakpoint để không tạo hydration flash không cần thiết.

## Phạm vi “desktop đóng băng”

Các file/component desktop không được sửa trong yêu cầu mobile. Nếu mobile cần cấu trúc khác, tạo file mới dưới thư mục `mobile` và truyền props từ controller. Không dùng selector CSS toàn cục để sửa một chi tiết mobile.
