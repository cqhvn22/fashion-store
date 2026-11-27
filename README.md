# Fashion Microservices

Thư mục này là gốc project. Frontend React/Vite hiện có được giữ nguyên.
Backend gồm các service Quarkus cho xác thực, danh mục, đơn hàng, PayOS và thông báo; AI service dùng FastAPI. Frontend Docker dùng Auth, Catalog và Order service. Chế độ chạy Vite mặc định vẫn dùng dữ liệu demo nếu chưa bật các biến `VITE_USE_DB_*`.

## Yêu cầu

- Java 21, Maven 3.9+, Node.js 20+, Python 3.12+; Docker Compose nếu chạy bằng container.
- Quarkus 3.40.1.1 LTS cho năm module Java.

## Chạy thử

- Tạo `.env` từ `.env.example`, rồi chạy `pwsh -File scripts/setup/prepare-env.ps1` (PowerShell 7) từ thư mục gốc để sinh `JWT_SECRET`, `JWT_VERIFY_JWK` và `INTERNAL_API_KEY` đồng bộ. Đặt `ADMIN_EMAIL` và `ADMIN_PASSWORD` (ít nhất 12 ký tự) để tạo tài khoản quản trị ở lần chạy đầu. Đặt khóa PayOS nếu muốn thử thanh toán thật. Chạy `pwsh -File scripts/setup/start-ollama-rag.ps1` để chuẩn bị model AI cục bộ.
- Frontend: `cd frontend && npm ci && npm run dev`
- Build backend: `mvn -f backend/pom.xml verify`
- Docker backend: `docker compose --env-file .env -f infrastructure/docker/compose.yaml up -d --build postgres kafka auth-service catalog-service order-service notification-service ai-service api-gateway`
- Kết nối PostgreSQL Docker từ pgAdmin/DBeaver tại `127.0.0.1:15432` với user `fashion` và mật khẩu `POSTGRES_PASSWORD` trong `.env`. Các service trong Docker vẫn kết nối `postgres:5432`.
- Muốn chạy frontend container thì thêm `frontend` vào cuối lệnh. MongoDB tùy chọn ở `compose.dev.yaml`.

Trong frontend Docker, đăng ký tài khoản mới tại `/register`, sau đó vào **Tài khoản → Sổ địa chỉ** hoặc **Thanh toán → Ghi nhớ địa chỉ này cho lần sau**. Checkout tải danh sách địa chỉ từ Auth service để chọn nhanh và tự chọn địa chỉ mặc định. Tài khoản demo mock `user@fashionhub.vn` chỉ dùng khi chạy frontend ở chế độ mock hoàn toàn (`VITE_USE_DB_AUTH=false`); frontend Docker không dùng tài khoản đó. Phiên đăng nhập được giữ qua lần đóng trình duyệt bằng refresh token, tự làm mới khi cần và chỉ bị thu hồi khi đăng xuất hoặc đổi mật khẩu. Mật khẩu được băm bằng BCrypt trên server; refresh token chỉ được lưu dưới dạng băm trong PostgreSQL.

## Dữ liệu thử nghiệm

Sau khi PostgreSQL và Catalog chạy, nạp bộ ATINO từ `ai-service/atino_products.xlsx` bằng `pwsh -File scripts/seed/activate-atino.ps1` (mặc định project Compose `fashion-codex`; có thể truyền `-ProjectName <tên>`). Script nạp 280 sản phẩm, 814 ảnh và 3.234 biến thể vào `fashion_catalog`, kích hoạt 4 danh mục gốc ATINO và cập nhật banner trang chủ. Dữ liệu demo cũ được chuyển sang trạng thái không bán để giữ tham chiếu của đơn hàng và đánh giá trước đó. Chạy lại không tạo bản ghi trùng.

Frontend tại `localhost:5173` lấy danh mục, sản phẩm và banner từ PostgreSQL qua Gateway theo `frontend/.env.development`. Có thể kiểm tra `http://localhost:8080/api/v1/products?category=ao-nam`. Trong admin, ảnh sản phẩm và banner được tải lên Catalog service (JPG/PNG/WebP, tối đa 5 MB/ảnh), lưu tại volume Docker `catalog_media`; cơ sở dữ liệu lưu URL và ảnh chính. Banner đang hoạt động tự chuyển trên trang chủ.

Các service Quarkus có health check tại `/q/health`; Gateway chuyển tiếp `/api/v1`. PostgreSQL tự tạo database ở lần khởi tạo volume đầu tiên; Flyway chạy migration của từng service, AI service chạy migration riêng. Auth phát JWT ký HS256, các API có quyền kiểm tra token tại service. Order gọi Catalog qua gRPC trên cổng nội bộ 9000 để giữ, xác nhận hoặc hoàn tồn kho; hợp đồng protobuf nằm tại `backend/common/src/main/resources/inventory.proto`. Order hỗ trợ COD và tạo link PayOS khi có cấu hình. Webhook PayOS được kiểm tra chữ ký và chống xử lý lặp; sự kiện Order được đưa lên Kafka qua outbox, Notification ghi thông báo trong ứng dụng.

`POST /api/v1/orders` yêu cầu header `Idempotency-Key` và `paymentMethod` là `COD` hoặc `PAYOS`. Checkout cho khách chọn COD hoặc chuyển khoản qua PayOS; đơn PayOS hiển thị QR trong popup, tự kiểm tra trạng thái mỗi 5 giây khi popup mở và chỉ được xác nhận qua webhook đã kiểm tra chữ ký. Điền `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY` trong `.env` và đăng ký webhook HTTPS công khai ở PayOS; xem [hướng dẫn PayOS](docs/deployment/payos.md). AI RAG dùng Qwen3 Embedding 0.6B qua Ollama; model trả lời phụ thuộc `AI_PROVIDER`/`AI_CHAT_MODEL` trong `.env` (hiện là OpenRouter/Nemotron). Xem [các bước xây dựng RAG](docs/architecture/ai-rag-build-guide.md) và [bản đánh giá](docs/architecture/ai-rag-audit.md).

Notification ghi thông báo `IN_APP` cho khách khi trạng thái đơn thay đổi và cho admin khi có đơn mới. Chuông thông báo trên frontend kiểm tra cập nhật định kỳ 10 giây; mỗi người chỉ đọc và đánh dấu thông báo của mình. Email/SMS và quy trình hoàn tiền PayOS chưa triển khai. Không dùng file `.env` thật trong Git.

Biểu đồ use case tổng quát và phạm vi từng actor: [docs/uml/use-case-overview.md](docs/uml/use-case-overview.md).

Bản mô tả chức năng, kiến trúc và SQL CSDL theo service: [docs/architecture/system-description.md](docs/architecture/system-description.md).

| Service | Port |
| --- | ---: |
| API gateway | 8080 |
| Auth | 8081 |
| Catalog | 8082 |
| Order | 8083 |
| Notification | 8084 |
| AI | 8000 |
| Frontend Docker | 3000 |

### Gửi email qua Resend

Đặt `RESEND_API_KEY` và `RESEND_FROM` trong `.env`. Địa chỉ gửi phải thuộc tên miền đã xác minh trong Resend, ví dụ `FashionHub <news@ten-mien-cua-ban.vn>`. Đặt `MAIL_PUBLIC_URL` thành địa chỉ HTTPS công khai của FashionHub để liên kết hủy đăng ký hoạt động từ hộp thư. Có thể điều chỉnh `RESEND_REQUESTS_PER_SECOND` theo hạn mức của tài khoản Resend.

Sau khi sửa `.env`, chạy `docker compose -p fashion-codex --env-file .env -f infrastructure/docker/compose.yaml up -d --no-deps --force-recreate auth-service` để container Auth nhận cấu hình mới. Nếu stack đang dùng tên project Compose khác, thay `fashion-codex` bằng tên project đó.

Tại [trang quên mật khẩu](http://localhost:3000/forgot-password), khách hàng nhập mã 6 chữ số có hiệu lực 10 phút rồi đặt mật khẩu mới. Hệ thống cho thử tối đa 5 lần trên mỗi mã và cấp lại mã sau ít nhất 1 phút.

Tại [Chiến dịch email](http://localhost:3000/admin/email), quản trị viên có thể chọn từng email hoặc cả nhóm khách đăng ký bản tin. Hàng đợi lưu tiến độ trong PostgreSQL và thử lại lỗi tạm thời. Chỉ số “Resend đã tiếp nhận” thể hiện kết quả tiếp nhận của API. Để xem sự kiện chuyển phát, mở nhật ký trong Resend.
