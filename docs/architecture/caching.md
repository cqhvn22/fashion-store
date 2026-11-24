# Chính sách cache của FashionHub

Cache chỉ áp dụng cho dữ liệu đọc nhiều và có thể chấp nhận độ trễ ngắn. Giá, tồn kho, thanh toán, đơn hàng, quyền quản trị và dữ liệu cá nhân không được đưa vào cache phía Catalog.

| Lớp | Dữ liệu | Thời hạn | Làm mới |
|---|---|---:|---|
| Catalog Service (bộ nhớ tiến trình) | Danh mục công khai, banner, cấu hình danh mục trang chủ | 30 giây | Xóa ngay sau thao tác thêm/sửa/xóa tương ứng; hết hạn tự đọc DB lại. |
| React Query (bộ nhớ tab) | Danh mục, banner, cấu hình trang chủ | 2 phút; giữ tối đa 15 phút khi không sử dụng | Invalidate sau thao tác quản trị và khi nhận tín hiệu từ tab khác. |
| React Query (bộ nhớ tab) | Danh sách và chi tiết sản phẩm | 15 giây | Invalidate khi sản phẩm, khuyến mãi hoặc đánh giá thay đổi. Checkout vẫn kiểm tra giá và tồn kho tại server. |
| HTTP cache của trình duyệt | Ảnh sản phẩm tĩnh | 24 giờ | Tên tệp ảnh mới tạo URL mới; ảnh không hợp lệ trả 404. |

Dữ liệu mẫu của danh mục chỉ dùng làm placeholder khi đợi API. Nó không đánh dấu kết quả truy vấn là mới, nên lần truy cập đầu vẫn lấy danh mục thật. Header chỉ tải danh sách sản phẩm để chọn ảnh khi có danh mục chưa có ảnh trực tiếp hoặc ảnh mặc định. Cache React Query được xóa khi đổi tài khoản để không giữ dữ liệu cá nhân của phiên trước.

Các thay đổi quản trị ở tab này invalidate query tại nơi thực hiện. BroadcastChannel phát tín hiệu cho các tab khác; các khóa thay đổi được gom trong một lần debounce để không bỏ sót khi nhiều loại dữ liệu cập nhật sát nhau. Catalog cache là cache cục bộ theo tiến trình, không đồng bộ giữa nhiều replica. Khi triển khai nhiều replica, giới hạn trễ tối đa của metadata giữa các replica là TTL 30 giây; nếu cần đồng bộ tức thời, sử dụng invalidation phân tán.
