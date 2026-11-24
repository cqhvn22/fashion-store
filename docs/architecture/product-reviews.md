# Nhận xét, đánh giá sản phẩm

## Quy tắc nghiệp vụ

- Khách đăng nhập chỉ đánh giá từng dòng sản phẩm trong đơn của chính mình sau khi đơn chuyển sang **Đã giao**.
- Mỗi dòng đơn hàng được đánh giá tối đa một lần. Một sản phẩm mua ở hai đơn khác nhau có thể có hai đánh giá.
- Thời hạn tạo: 30 ngày sau khi giao. Khách được sửa đúng một lần trong 30 ngày từ lúc đăng; không tự xóa đánh giá.
- Đánh giá gồm 1–5 sao, nhận xét 10–2.000 ký tự và tối đa 5 ảnh JPG/PNG/WebP (5 MB/ảnh). Nội dung hiển thị tên khách được che một phần, dấu “Đã mua hàng”, phân loại hàng, ngày đăng, ảnh và phản hồi của cửa hàng.
- Quản trị viên có thể ẩn/hiện đánh giá và phản hồi. Chỉ đánh giá đang hiển thị được tính vào số lượt và điểm trung bình. Mọi thao tác tạo/sửa/ẩn đều tính lại số liệu trong cùng giao dịch.

Luồng này tham khảo [hướng dẫn đánh giá](https://help.shopee.vn/portal/4/article/79584-) và [quy định chỉnh sửa đánh giá](https://help.shopee.vn/portal/4/article/79118) của Shopee. Bản triển khai hiện hỗ trợ ảnh, chưa hỗ trợ video.

## Phân chia dữ liệu

- **Order service** xác nhận `order_item_id`, chủ đơn, trạng thái giao hàng và thời hạn qua API nội bộ có `X-Internal-Key`.
- **Catalog service** lưu `product_reviews`, `review_images`, điểm và số đánh giá trong PostgreSQL. API tạo/sửa bắt buộc JWT; `order_item_id` có ràng buộc duy nhất ở DB. Ảnh lưu trong media volume của Catalog.
- **Gateway** chuyển `/api/v1/reviews/*` tới Catalog. API nội bộ xác nhận đơn không được đưa qua Gateway.
- **Frontend** cho khách đánh giá từ chi tiết đơn hàng; trang sản phẩm hiển thị đánh giá và bộ lọc; `/admin/reviews` cho phép kiểm duyệt/phản hồi.

## API

| Phương thức | Đường dẫn | Vai trò |
| --- | --- | --- |
| GET | `/api/v1/reviews/product/{productId}?page=1&limit=10&rating=5&withImages=true` | Công khai |
| GET | `/api/v1/reviews/my?orderId={orderId}` | Khách |
| GET | `/api/v1/reviews/eligibility/{orderItemId}` | Khách |
| POST | `/api/v1/reviews` | Khách |
| PUT | `/api/v1/reviews/{id}` | Chủ đánh giá |
| POST | `/api/v1/reviews/media` | Khách |
| GET | `/api/v1/reviews/admin?page=1` | Quản trị |
| PATCH | `/api/v1/reviews/admin/{id}/visibility` | Quản trị |
| PUT | `/api/v1/reviews/admin/{id}/reply` | Quản trị |

Mẫu tạo: `{"orderItemId":"<uuid>","rating":5,"content":"Chất liệu đẹp, mặc vừa.","imageUrls":[]}`.

## Đồng bộ đơn hàng trong chế độ dữ liệu thử

Các trình duyệt hợp nhất đơn theo `updatedAt` và số bước lịch sử. Endpoint phát triển giữ bản mới hơn của từng đơn khi nhận POST, tránh bản sao cũ ghi đè trạng thái đã giao. Chế độ PostgreSQL đọc Order service trực tiếp.
