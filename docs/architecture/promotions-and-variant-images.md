# Giảm giá sản phẩm và ảnh theo biến thể

## Quy tắc nghiệp vụ

- Admin tạo chương trình cho **một sản phẩm**, chọn giảm theo phần trăm (1–99%) hoặc số tiền cố định, nhập tên, giờ bắt đầu, giờ kết thúc và trạng thái bật/tắt. Thời gian áp dụng là `[bắt đầu, kết thúc)` theo thời gian có múi giờ. Chương trình sắp diễn ra tự kích hoạt và tự kết thúc; tắt chương trình thì giá trở về giá niêm yết ngay.
- Hai chương trình đang bật của cùng sản phẩm không được chồng thời gian. Catalog khóa bản ghi sản phẩm khi tạo/sửa chương trình để kiểm tra xung đột. Không cộng dồn nhiều chương trình. Chương trình đã kết thúc và đã tắt vẫn được giữ để tra cứu.
- Giá niêm yết nằm ở từng `product_variants.price`. Giá hiển thị và giá đặt hàng được tính từ chương trình đang hiệu lực: `floor(giá niêm yết × (100 − % giảm) / 100)` hoặc `giá niêm yết − số tiền giảm`. Giá thấp nhất là 1.000 VND; khi cấu hình mức giảm hoặc hạ giá niêm yết, API từ chối nếu giá cuối cùng của biến thể có thể dưới mức này.
- Catalog dùng cùng view `current_variant_prices` cho API sản phẩm và giá snapshot khi Order giữ tồn qua gRPC. Order lưu đơn giá đã xác nhận vào `order_items`; thay đổi chương trình sau đó không đổi giá đơn đã tạo. Checkout gửi thêm giá khách vừa nhìn thấy; nếu giá máy chủ tăng, Order trả `409 PRICE_CHANGED` và yêu cầu khách kiểm tra lại trước khi đặt.
- Nhãn giảm giá và giá gạch ngang chỉ xuất hiện khi chương trình thực sự đang hiệu lực. Trường `products.original_price` cũ không còn điều khiển nhãn sale. Dữ liệu demo cũ được chuyển thành chương trình có thời hạn để giữ nguyên giá khách đang thấy.
- Mỗi biến thể có tối đa 8 ảnh riêng trong `variant_images`; nếu có ảnh riêng thì phải chọn đúng một ảnh chính. Khi khách đổi màu/size, bộ ảnh của biến thể được chọn thay thế bộ ảnh cũ. Nếu biến thể chưa có ảnh riêng, dùng ảnh chung của sản phẩm. Ảnh chính của biến thể cũng đi theo giỏ hàng và snapshot đơn hàng.

## API

| Đường dẫn | Quyền | Công dụng |
| --- | --- | --- |
| `GET /api/v1/admin/promotions` | Admin | Danh sách chương trình, trạng thái đang áp dụng/sắp diễn ra/đã kết thúc/đã tắt |
| `POST /api/v1/admin/promotions` | Admin | Tạo chương trình |
| `PUT /api/v1/admin/promotions/{id}` | Admin | Sửa hoặc tắt/bật lại chương trình |
| `GET /api/v1/products`, `GET /api/v1/products/slug/{slug}` | Công khai | Giá hiệu lực, giá so sánh, chương trình hiện tại, ảnh riêng của các biến thể |
| `POST /api/v1/orders` | Khách đăng nhập | Xác nhận lại giá qua gRPC và lưu snapshot đơn hàng |

Migration: `backend/catalog-service/src/main/resources/db/migration/V5__promotions_and_variant_images.sql`.

## Tài liệu tham khảo

- [Shopify: Sale pricing](https://help.shopify.com/en/manual/products/details/product-pricing/sale-pricing): phân biệt giá bán và giá so sánh ở sản phẩm/biến thể.
- [Adobe Commerce: Catalog price rules](https://experienceleague.adobe.com/en/docs/commerce-admin/marketing/promotions/catalog-rules/price-rules-catalog): quy tắc giảm giá có thời gian áp dụng và điều kiện.
- [Shopify: Images for variants](https://help.shopify.com/en/manual/products/product-media/add-images-variants): ảnh gắn với biến thể và đổi ảnh xem trước khi chọn biến thể. Project này mở rộng thành nhiều ảnh cho mỗi biến thể.
