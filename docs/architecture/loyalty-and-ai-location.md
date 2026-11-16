# Thành viên, ưu đãi và trợ lý cửa hàng

## Tích điểm và xếp hạng

Order service sở hữu `loyalty_settings`, `loyalty_tiers`, `loyalty_points` và `tier_promotions` trong `fashion_order`. Migration `V3__loyalty_and_tier_promotions.sql` tạo bảng và ghi lại các đơn cũ đã giao **và** đã thanh toán. Mỗi đơn chỉ có một bản ghi điểm (`order_id` là khóa chính), nên webhook PayOS hoặc thao tác thu COD lặp lại không cộng điểm lần nữa.

Mặc định: 1 điểm cho mỗi 1.000đ tiền hàng sau giảm giá, không gồm phí vận chuyển. Điểm được cộng khi đơn đạt cả hai điều kiện `DELIVERED` và `PAID`. Hạng xét theo số đơn **hoặc** chi tiêu trong 6 tháng gần nhất: Thành viên 0; Bạc 5 đơn hoặc 2 triệu đồng; Vàng 20 đơn hoặc 5 triệu đồng; Kim Cương 50 đơn hoặc 15 triệu đồng. Điểm đã tích là tổng lịch sử, còn hạng tính lại theo cửa sổ thời gian. Admin chỉnh quy đổi, kỳ xét hạng và các mốc tại `/admin/loyalty`.

Admin có thể tạo ưu đãi cho tất cả hoặc một hạng cụ thể, chọn giảm phần trăm hoặc số tiền, đơn tối thiểu, thời gian hiệu lực và trạng thái bật/tắt. Ưu đãi được tính trên tiền hàng đã áp dụng giảm giá sản phẩm. Khi có nhiều ưu đãi phù hợp, Order service chọn mức giảm cao nhất, chỉ áp dụng một ưu đãi theo hạng. Giá và ưu đãi được tính lại khi tạo đơn; `discount_amount` và `tier_promotion_id` được lưu cùng đơn. API `/api/v1/loyalty/quote?subtotal=...` chỉ dùng để hiển thị dự kiến ở checkout.

## Trợ lý AI

Frontend chỉ gọi `navigator.geolocation` khi câu hỏi tìm cửa hàng gần đây. Tọa độ được gửi riêng trong yêu cầu chat, không ghi vào lịch sử hội thoại. AI service dùng khoảng cách đường chim bay để xếp hạng cửa hàng; nếu khách từ chối quyền vị trí, trợ lý hỏi tỉnh/thành phố hoặc khu vực và lọc theo văn bản. Danh sách cửa hàng và tọa độ hiện là **dữ liệu mẫu**; trước khi vận hành thực tế cần xác minh vị trí và thông tin cửa hàng.

Với khách đã đăng nhập, AI service gọi nội bộ Order service bằng `X-Internal-Key` để lấy hạng, điểm và ưu đãi đang hiệu lực. Ngữ cảnh này đi vào lời nhắc cho OpenRouter. Model không được tự tạo ưu đãi hoặc giá.

Chỉ mục sản phẩm đồng bộ từ Catalog để tìm kiếm ngữ nghĩa. Khi admin sửa danh mục, sản phẩm, tồn kho hoặc khuyến mãi, Catalog gửi tín hiệu nội bộ để AI lập lại chỉ mục; tác vụ định kỳ 90 giây là lớp dự phòng nếu tín hiệu thất bại. Trước khi trả lời, AI service gọi lại chi tiết **sản phẩm đang được gợi ý** từ Catalog, lấy giá hiệu lực, giá gốc, khuyến mãi và tồn kho mới nhất. Sản phẩm đã ẩn hoặc hết hàng bị bỏ qua. Nếu Catalog không phản hồi, chatbot báo lỗi kiểm tra giá thay vì nói một mức giá cũ.

## API chính

| API | Quyền | Mục đích |
| --- | --- | --- |
| `GET /api/v1/loyalty/me` | User/Admin | Hạng, điểm, hoạt động và ưu đãi |
| `GET /api/v1/loyalty/quote?subtotal=` | User/Admin | Ước tính giảm giá |
| `GET/PUT /api/v1/admin/loyalty/settings` | Admin | Quy đổi điểm, kỳ xét hạng |
| `PUT /api/v1/admin/loyalty/tiers/{code}` | Admin | Điều chỉnh mốc hạng |
| `GET/POST/PUT/DELETE /api/v1/admin/tier-promotions` | Admin | Ưu đãi theo hạng; DELETE tắt ưu đãi |
| `GET /api/v1/internal/loyalty/{userId}` | Khóa nội bộ | Ngữ cảnh chatbot |

Điểm hiện dùng để theo dõi thành viên; chưa có cơ chế đổi điểm lấy tiền hoặc hiện vật.
