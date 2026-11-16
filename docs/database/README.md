# Bản xuất cấu trúc cơ sở dữ liệu FashionHub

**Nguồn:** năm PostgreSQL đang chạy trong Docker Compose của project, xuất ngày 16/11/2026. Các tệp SQL trong thư mục [`schema-export`](schema-export/) là kết quả `pg_dump --schema-only`; chúng chứa bảng, khóa, ràng buộc, chỉ mục, view, hàm và trigger, **không chứa bản ghi khách hàng, mật khẩu, khóa API hoặc dữ liệu sản phẩm**. Đây là ảnh chụp cấu trúc tại thời điểm xuất, không thay thế các migration dùng khi triển khai ứng dụng.

| Database | Service sở hữu | Tệp SQL | Bảng nghiệp vụ |
|---|---|---|---:|
| `fashion_auth` | Auth | [fashion_auth.sql](schema-export/fashion_auth.sql) | 4 |
| `fashion_catalog` | Catalog | [fashion_catalog.sql](schema-export/fashion_catalog.sql) | 13 |
| `fashion_order` | Order | [fashion_order.sql](schema-export/fashion_order.sql) | 13 |
| `fashion_notification` | Notification | [fashion_notification.sql](schema-export/fashion_notification.sql) | 4 |
| `fashion_ai` | AI | [fashion_ai.sql](schema-export/fashion_ai.sql) | 7 |

Tổng cộng **41 bảng nghiệp vụ** và 5 bảng theo dõi migration. Năm database cùng nằm trên **một PostgreSQL instance** trong môi trường Docker hiện tại và cùng dùng tài khoản kết nối `fashion`; mức tách biệt ở đây là database theo service, chưa phải tách máy chủ hay tài khoản DB.

## Từ điển bảng

### Auth (`fashion_auth`)

| Bảng | Vai trò |
|---|---|
| `users` | Tài khoản, vai trò và mật khẩu đã băm. |
| `addresses` | Địa chỉ nhận hàng đã lưu của người dùng. |
| `refresh_tokens` | Phiên đăng nhập có thể làm mới và thu hồi. |
| `password_reset_tokens` | Mã phục vụ quy trình đặt lại mật khẩu. |

### Catalog (`fashion_catalog`)

| Bảng/view | Vai trò |
|---|---|
| `categories` | Cây danh mục nhiều cấp qua `parent_id` tự tham chiếu. |
| `products` | Thông tin sản phẩm và danh mục của sản phẩm. |
| `product_variants` | SKU, màu, cỡ, giá và tồn kho theo biến thể. |
| `product_images`, `variant_images` | Ảnh sản phẩm, ảnh theo biến thể và thông tin ảnh chính. |
| `product_promotions`, `current_variant_prices` | Đợt giảm giá và giá hiệu lực của biến thể. |
| `inventory_reservations`, `inventory_movements` | Giữ hàng khi đặt và lịch sử biến động tồn kho. |
| `product_reviews`, `review_images` | Đánh giá của khách đã mua và ảnh đánh giá. |
| `wishlist_items` | Sản phẩm yêu thích. |
| `home_banners`, `home_categories` | Banner và danh mục hiển thị tại trang chủ. |

### Order (`fashion_order`)

| Bảng | Vai trò |
|---|---|
| `carts`, `cart_items` | Giỏ hàng và dòng hàng; mỗi biến thể có số lượng riêng. |
| `orders`, `order_items` | Đơn hàng, thông tin giao nhận và ảnh chụp các dòng hàng lúc mua. |
| `order_status_history` | Lịch sử thay đổi trạng thái đơn. |
| `payment_attempts`, `payment_status_history`, `payment_webhook_events` | Các lần thanh toán, lịch sử thanh toán và webhook PayOS. |
| `outbox_events` | Sự kiện chờ phát sang Kafka. |
| `loyalty_settings`, `loyalty_tiers`, `loyalty_points`, `tier_promotions` | Cấu hình tích điểm, hạng thành viên, phát sinh điểm và ưu đãi theo hạng. |

### Notification (`fashion_notification`)

| Bảng | Vai trò |
|---|---|
| `processed_events` | Dấu vết sự kiện Kafka đã xử lý để tránh xử lý lặp. |
| `notification_templates` | Mẫu nội dung thông báo. |
| `notifications` | Thông báo trong ứng dụng cho khách hoặc quản trị viên. |
| `notification_attempts` | Lịch sử lần phát/thử gửi thông báo. |

### AI (`fashion_ai`)

| Bảng | Vai trò |
|---|---|
| `product_documents` | Chỉ mục sản phẩm từ Catalog và workbook, hash nội dung, embedding. |
| `knowledge_documents`, `knowledge_chunks` | Tài liệu tư vấn do quản trị quản lý và các đoạn đã nhúng vector. |
| `conversations`, `chat_messages` | Hội thoại và tin nhắn để duy trì ngữ cảnh. |
| `chat_message_sources`, `chat_message_product_suggestions` | Nguồn tham chiếu và sản phẩm gợi ý gắn với câu trả lời. |

Khóa ngoại chỉ được tạo **trong từng database**. Tham chiếu xuyên service như `orders.user_id` hoặc gợi ý `product_id` được quản lý bằng API và ID, không có khóa ngoại liên database.

## Quy mô dữ liệu tại thời điểm khảo sát

Các số liệu sau chỉ dùng để mô tả môi trường đang chạy, không có trong SQL xuất: 15 tài khoản; 42 danh mục; 280 sản phẩm đang hoạt động; 3.286 biến thể (gồm cả dữ liệu demo không hoạt động); 824 ảnh sản phẩm; 6 đơn hàng; 11 thông báo; 280 tài liệu Catalog và 280 tài liệu workbook trong chỉ mục AI; 6 tài liệu tri thức; 79 hội thoại. Khi khảo sát, bảng đánh giá, điểm tích lũy và ưu đãi theo hạng chưa có bản ghi. Số liệu sẽ thay đổi khi sử dụng hệ thống.

## Cách tái tạo bản xuất và sử dụng

Chạy `pg_dump` với tùy chọn `--schema-only --no-owner --no-privileges --no-comments --no-tablespaces` cho từng database. Ví dụ trong container PostgreSQL:

```powershell
docker compose -f infrastructure/docker/compose.yaml exec -T postgres pg_dump -U fashion -d fashion_catalog --schema-only --no-owner --no-privileges --no-comments --no-tablespaces > docs/database/schema-export/fashion_catalog.sql
```

Để dựng lại **cấu trúc** vào một database rỗng, tạo database đó trước rồi thực thi tệp SQL bằng `psql -v ON_ERROR_STOP=1 -f <tệp>`. Không chạy tệp schema vào database đã có bảng vì lệnh `CREATE` sẽ xung đột. Với ứng dụng đang chạy, dùng migration của từng service để khởi tạo và nâng cấp schema; bản xuất này phục vụ đối chiếu, phụ lục báo cáo và khảo sát CSDL.
