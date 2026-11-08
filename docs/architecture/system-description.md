# Mô tả hệ thống FashionHub và thiết kế CSDL theo service

> **Trạng thái tài liệu:** đặc tả triển khai đề xuất, dựa trên giao diện React hiện có, dữ liệu mẫu, hợp đồng API dự kiến và khung microservices trong repository. Đây không phải mô tả một backend đã hoàn thành. Ngày lập: 08/11/2026.

## 1. Mục tiêu và phạm vi

FashionHub là website bán thời trang cho khách truy cập, khách hàng và quản trị viên. Khách hàng tìm sản phẩm theo danh mục, bộ lọc và tìm kiếm; chọn biến thể màu/size, đặt hàng COD hoặc thanh toán trực tuyến qua PayOS, theo dõi đơn và nhận tư vấn từ chatbot. Quản trị viên quản lý danh mục, sản phẩm, tồn kho, đơn hàng, kho tri thức và báo cáo.

Phạm vi bản MVP được rút từ các route tại frontend/src/app/App.tsx, các model tại frontend/src/types/models.ts và yêu cầu tại frontend/implement.md, đồng thời bổ sung PayOS theo yêu cầu mới. Thanh toán PayOS là **phần cần triển khai**, chưa có trên giao diện và backend hiện tại. Đánh giá sản phẩm, khuyến mãi và gửi email khôi phục mật khẩu chưa nằm trong luồng đã xây dựng.

### 1.1. Vai trò và chức năng

| Vai trò | Chức năng |
| --- | --- |
| Khách truy cập | Xem trang chủ, danh mục, sản phẩm và chính sách; tìm kiếm/lọc/sắp xếp; xem chi tiết và biến thể; dùng giỏ hàng, danh sách yêu thích và chatbot; đăng ký/đăng nhập. |
| Khách hàng | Tất cả quyền trên; cập nhật hồ sơ, sổ địa chỉ; chọn COD hoặc PayOS khi đặt hàng; xem trạng thái thanh toán và lịch sử/chi tiết đơn; hủy đơn đủ điều kiện; đăng xuất. |
| Quản trị viên | Tất cả quyền trên; xem dashboard; tạo/sửa/xóa sản phẩm, biến thể và danh mục; điều chỉnh tồn kho; xem và cập nhật trạng thái đơn; quản lý tài liệu tri thức; xem hội thoại, báo cáo và danh sách người dùng. |

### 1.2. Trạng thái triển khai hiện tại

| Thành phần | Đã có | Cần triển khai |
| --- | --- | --- |
| Frontend | Giao diện và luồng COD bằng mock data; giỏ hàng, yêu thích và một số dữ liệu lưu ở trình duyệt. | Thêm lựa chọn PayOS, trang chờ/kết quả thanh toán; kết nối và kiểm thử với API thật. |
| API Gateway | Ứng dụng Quarkus chuyển tiếp các đường dẫn /api/v1 và có health check. | Xác thực/ủy quyền ở lớp phù hợp, quan sát và xử lý lỗi đầy đủ. |
| Auth, Catalog, Order, Notification | Khung Quarkus, cấu hình và health check. | Resource, nghiệp vụ, migration, truy cập CSDL, bảo mật và kiểm thử; Order tích hợp PayOS. |
| AI service | FastAPI với health check. | Chat, quản trị tri thức, ingestion, embeddings và retrieval thực. |
| Kafka, PostgreSQL, MongoDB | Có cấu hình Compose phát triển. | Topic, database riêng, migration và tích hợp service. |

Chức năng quên mật khẩu hiện chỉ xác nhận yêu cầu trong giao diện demo; đổi mật khẩu chưa tích hợp. Chatbot hiện trả lời theo quy tắc và tài liệu mẫu, chưa phải AI/RAG thực. Notification service chưa gửi email/SMS. **Chưa có giao dịch PayOS thực trong repository.**

## 2. Kiến trúc tổng quan

~~~text
Browser (React/Vite)
        |
     HTTPS /api/v1
        |
API Gateway (8080)
  |-- Auth service (8081)         -> fashion_auth
  |-- Catalog service (8082)      -> fashion_catalog
  |-- Order service (8083)        -> fashion_order
  |                                  <-> PayOS API/webhook (dịch vụ bên ngoài)
  |-- AI service (8000)           -> fashion_ai
  |
  +-- Notification service (8084) <- Kafka events -> fashion_notification
~~~

Frontend chỉ gọi API Gateway; không truy cập database hoặc Kafka. Mỗi service sở hữu một database PostgreSQL riêng. Các khóa như user_id, product_id, variant_id, order_id đi qua ranh giới service chỉ là định danh tham chiếu; **không tạo foreign key giữa các database**. Order lưu snapshot sản phẩm, giá và địa chỉ tại thời điểm đặt để lịch sử không đổi khi danh mục/hồ sơ thay đổi.

MongoDB có trong Compose nhưng chưa được sử dụng trong phương án SQL của tài liệu này. Nếu quyết định chuyển tài liệu AI sang MongoDB sau này, cần thiết kế migration và bỏ các bảng tương ứng trong fashion_ai; không nên ghi cùng một dữ liệu ở hai nguồn chính.

### 2.1. Trách nhiệm từng service

| Service | Sở hữu nghiệp vụ và dữ liệu | API dự kiến |
| --- | --- | --- |
| API Gateway | Điểm vào, route, kiểm tra token/quyền ở mức cổng; **không có CSDL riêng**. | Chuyển tiếp /api/v1/... |
| Auth | Tài khoản, mật khẩu đã băm, vai trò USER/ADMIN, phiên/refresh token, sổ địa chỉ. | /auth/register, /auth/login, /auth/logout, /auth/refresh, /users/me, /users/me/addresses |
| Catalog | Danh mục, sản phẩm, ảnh, biến thể, giá, tồn kho, yêu thích, đặt giữ tồn. | /products, /products/slug/{slug}, /categories, /admin/products, /admin/categories, /admin/inventory |
| Order | Giỏ hàng của tài khoản, đơn COD/PayOS, trạng thái thanh toán, payment attempt, webhook, dòng hàng snapshot, lịch sử trạng thái và outbox sự kiện. Không tạo service thanh toán riêng trong MVP. | /cart, /orders, /orders/my, /orders/{id}, /orders/{id}/cancel, /payments/payos/webhook, /admin/orders |
| Notification | Mẫu thông báo, hàng đợi gửi, lịch sử thử gửi, chống xử lý trùng sự kiện. | Chủ yếu nhận Kafka; API nội bộ/health nếu cần. |
| AI | Tài liệu tri thức, đoạn tài liệu, embeddings, hội thoại, nguồn trích dẫn và gợi ý sản phẩm. | /chat, /chat/conversations, /admin/knowledge |

Các endpoint ở trên là **đề xuất**, cần thống nhất với frontend/API_CONTRACT.md. Khi triển khai PayOS, Gateway cần chuyển tiếp đường dẫn webhook công khai đến Order mà không yêu cầu token người dùng; Order tự xác minh chữ ký PayOS. Các route khác cũng cần đối chiếu với danh sách API thực tế.

### 2.2. Luồng chính và quy tắc nghiệp vụ

1. **Duyệt sản phẩm:** Catalog trả về sản phẩm ACTIVE, danh mục đang hiển thị, biến thể còn hàng; hỗ trợ q, category, minPrice, maxPrice, size, color, sort và phân trang. Trang admin có thể xem cả DRAFT/INACTIVE.
2. **Đặt hàng:** Order lấy user_id từ token, nhận variantId và quantity của các món được chọn, gọi Catalog để xác nhận biến thể/giá và giữ tồn, tính lại tiền trên server, tạo đơn PENDING với địa chỉ snapshot và payment_method = COD hoặc PAYOS. Không tin unitPrice hoặc totalAmount gửi từ browser.
3. **Thanh toán COD:** Đơn bắt đầu với payment_status = UNPAID. Cửa hàng thu tiền khi giao hàng; việc xác nhận đã thu tiền là thao tác nghiệp vụ riêng, không được suy ra chỉ từ việc tạo đơn.
4. **Thanh toán PayOS:** Order tạo payment attempt và mã orderCode dạng số duy nhất cho PayOS, gọi API tạo link bằng số tiền đã tính trên server, lưu paymentLinkId/checkoutUrl và trả checkoutUrl cho frontend chuyển hướng. Đơn và payment_status ở PENDING cho đến khi có kết quả xác thực. Order nhận webhook, kiểm tra signature, orderCode, paymentLinkId và amount; xử lý idempotent rồi chuyển payment_status sang PAID và đơn sang CONFIRMED khi hợp lệ. returnUrl/cancelUrl chỉ phục vụ hiển thị và tải lại trạng thái từ backend, **không phải bằng chứng thanh toán**. [API PayOS](https://payos.vn/docs/api/), [webhook](https://payos.vn/docs/du-lieu-tra-ve/webhook/).
5. **Tồn kho liên service:** Catalog giữ tồn bằng reservation có thời hạn, bao gồm thời gian khách thanh toán PayOS. Khi thanh toán thành công, Order xác nhận reservation; khi link hết hạn/hủy hoặc thanh toán thất bại, Order hủy đơn và giải phóng reservation. Các thao tác phải có idempotency key; thiết kế production cần saga/compensation cho lỗi giữa các service, không có transaction SQL xuyên service.
6. **Trạng thái đơn và thanh toán:** Trạng thái đơn và payment_status là hai trường độc lập. Luồng đơn: PENDING → CONFIRMED hoặc CANCELLED; CONFIRMED → PROCESSING hoặc CANCELLED; PROCESSING → SHIPPING; SHIPPING → DELIVERED. Khách chỉ tự hủy đơn COD hoặc PayOS **chưa thanh toán** ở trạng thái PENDING/CONFIRMED. Đơn PayOS đã PAID không tự hủy trong MVP vì chưa có quy trình hoàn tiền; cần xử lý thủ công hoặc bổ sung hoàn tiền trước khi mở quyền này. Hoàn tồn phải thực hiện đúng một lần.
7. **Sự kiện:** Order ghi outbox trong cùng transaction với thay đổi đơn/thanh toán; publisher đưa order.created, order.status_changed, order.cancelled và payment.paid lên Kafka. Notification tiêu thụ idempotent và tạo yêu cầu gửi; thất bại gửi không làm mất đơn.
8. **Chatbot:** AI nhận câu hỏi và conversationId, truy xuất đoạn tri thức, trả lời kèm nguồn và productIds gợi ý. Catalog là nguồn sự thật cho tên/giá/tồn sản phẩm; AI chỉ lưu ID gợi ý và tài liệu tri thức của mình.
9. **Báo cáo:** Dashboard/doanh thu tính từ đơn đã DELIVERED trong Order; số lượng sản phẩm/tồn từ Catalog. Báo cáo phải tách doanh thu giao hàng và số tiền đã thu, tránh gộp đơn COD chưa thu với giao dịch PayOS đã PAID. Ở MVP có thể tổng hợp qua API nội bộ; sau này dùng read model riêng khi tải lớn.

Quy tắc phí vận chuyển hiện có trong mock: đơn từ **500.000 VND** được miễn phí, dưới mức đó **30.000 VND**. Đây là cấu hình nghiệp vụ đề xuất để backend đồng nhất với giao diện, không phải phí cố định vĩnh viễn.

## 3. Quy ước CSDL và cách chạy SQL

- PostgreSQL 17, một database cho mỗi service: fashion_auth, fashion_catalog, fashion_order, fashion_notification, fashion_ai. Service dùng tài khoản chỉ có quyền trên database của mình.
- ID dùng UUID do ứng dụng tạo; tiền VND dùng BIGINT số nguyên, không dùng FLOAT. Thời gian dùng TIMESTAMPTZ UTC; frontend định dạng theo múi giờ người dùng.
- Mỗi khối SQL dưới đây chạy **riêng** trong database tương ứng sau khi tạo database. Dùng Flyway/Liquibase để đưa vào migration khi triển khai; hiện chưa có migration trong repo.
- Các bảng bổ sung cho chức năng API mode được đánh dấu **đề xuất**; giỏ hàng/yêu thích/địa chỉ hiện còn ở localStorage trong mock mode.
- Không lưu access token hoặc refresh token dạng rõ. password_hash phải tạo bằng Argon2id hoặc BCrypt ở Auth service; SQL chỉ lưu kết quả.

Chạy các câu sau bằng tài khoản quản trị PostgreSQL, từng câu ngoài transaction:

~~~sql
CREATE DATABASE fashion_auth;
CREATE DATABASE fashion_catalog;
CREATE DATABASE fashion_order;
CREATE DATABASE fashion_notification;
CREATE DATABASE fashion_ai;
~~~

### 3.1. Auth service — database fashion_auth

Bảng users khớp User model; addresses hỗ trợ trang sổ địa chỉ; refresh_tokens và password_reset_tokens phục vụ API xác thực tương lai. Email chuẩn hóa thành chữ thường trong ứng dụng và có unique index không phân biệt hoa/thường.

~~~sql
CREATE TABLE users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    password_hash TEXT NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    phone VARCHAR(20),
    avatar_url TEXT,
    role VARCHAR(10) NOT NULL DEFAULT 'USER'
        CHECK (role IN ('USER', 'ADMIN')),
    status VARCHAR(10) NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('ACTIVE', 'LOCKED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ux_users_email_lower ON users (lower(email));
CREATE INDEX ix_users_role_status ON users (role, status);

CREATE TABLE addresses (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipient_name VARCHAR(150) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    province VARCHAR(120) NOT NULL,
    district VARCHAR(120) NOT NULL,
    ward VARCHAR(120) NOT NULL,
    detail VARCHAR(300) NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_addresses_user ON addresses (user_id);
CREATE UNIQUE INDEX ux_addresses_one_default
    ON addresses (user_id) WHERE is_default;

CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash CHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_refresh_tokens_user ON refresh_tokens (user_id);

CREATE TABLE password_reset_tokens (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash CHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_password_reset_tokens_user ON password_reset_tokens (user_id);
~~~

### 3.2. Catalog service — database fashion_catalog

Một sản phẩm thuộc một danh mục, có nhiều ảnh và biến thể SKU. Tồn khả dụng = stock_quantity − reserved_quantity. Wishlist là dữ liệu Catalog theo user_id do Auth cấp, nhưng không có foreign key sang fashion_auth. Inventory reservation và movement phục vụ luồng đặt/hủy đơn và audit điều chỉnh thủ công.

~~~sql
CREATE TABLE categories (
    id UUID PRIMARY KEY,
    parent_id UUID REFERENCES categories(id) ON DELETE RESTRICT,
    name VARCHAR(150) NOT NULL,
    slug VARCHAR(180) NOT NULL UNIQUE,
    description TEXT,
    image_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (parent_id IS NULL OR parent_id <> id)
);
CREATE INDEX ix_categories_parent ON categories (parent_id);

CREATE TABLE products (
    id UUID PRIMARY KEY,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    slug VARCHAR(220) NOT NULL UNIQUE,
    name VARCHAR(250) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    brand VARCHAR(120),
    status VARCHAR(10) NOT NULL DEFAULT 'DRAFT'
        CHECK (status IN ('ACTIVE', 'INACTIVE', 'DRAFT')),
    original_price BIGINT CHECK (original_price IS NULL OR original_price >= 0),
    rating_average NUMERIC(3,2) NOT NULL DEFAULT 0
        CHECK (rating_average BETWEEN 0 AND 5),
    review_count INTEGER NOT NULL DEFAULT 0 CHECK (review_count >= 0),
    sold_count INTEGER NOT NULL DEFAULT 0 CHECK (sold_count >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_products_category_status ON products (category_id, status);
CREATE INDEX ix_products_name_search ON products (lower(name));

CREATE TABLE product_images (
    id UUID PRIMARY KEY,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    alt VARCHAR(250) NOT NULL DEFAULT '',
    is_primary BOOLEAN NOT NULL DEFAULT false,
    sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX ix_product_images_product ON product_images (product_id, sort_order);
CREATE UNIQUE INDEX ux_product_images_primary
    ON product_images (product_id) WHERE is_primary;

CREATE TABLE product_variants (
    id UUID PRIMARY KEY,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    sku VARCHAR(80) NOT NULL UNIQUE,
    color VARCHAR(80) NOT NULL,
    color_code VARCHAR(20),
    size VARCHAR(40) NOT NULL,
    price BIGINT NOT NULL CHECK (price >= 0),
    stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
    reserved_quantity INTEGER NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
    image_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (reserved_quantity <= stock_quantity)
);
CREATE INDEX ix_product_variants_product ON product_variants (product_id);
CREATE INDEX ix_product_variants_filter ON product_variants (size, color, price);

CREATE TABLE inventory_reservations (
    id UUID PRIMARY KEY,
    checkout_id UUID NOT NULL,
    variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    status VARCHAR(12) NOT NULL DEFAULT 'RESERVED'
        CHECK (status IN ('RESERVED', 'COMMITTED', 'RELEASED')),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (checkout_id, variant_id)
);
CREATE INDEX ix_inventory_reservations_expiry
    ON inventory_reservations (expires_at) WHERE status = 'RESERVED';

CREATE TABLE inventory_movements (
    id UUID PRIMARY KEY,
    variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
    delta INTEGER NOT NULL CHECK (delta <> 0),
    reason VARCHAR(20) NOT NULL
        CHECK (reason IN ('ADMIN_ADJUST', 'ORDER_COMMIT', 'ORDER_CANCEL')),
    reference_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_inventory_movements_variant_time
    ON inventory_movements (variant_id, created_at DESC);

CREATE TABLE wishlist_items (
    user_id UUID NOT NULL,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, product_id)
);
~~~

Giá minPrice/maxPrice trong response được tính từ các biến thể đang hoạt động; không cần lưu lặp trên products. Trường rating_average/review_count là dữ liệu hiển thị từ mock hiện tại, chưa có module đánh giá sản phẩm trong MVP.

### 3.3. Order service — database fashion_order

Giỏ hàng server là phần **đề xuất cho API mode**; khách chưa đăng nhập tiếp tục dùng giỏ local trên frontend. Order lưu snapshot của địa chỉ và sản phẩm. Order cũng sở hữu trạng thái thanh toán, từng lần tạo link PayOS và lịch sử webhook; không cần database hay service thanh toán riêng. `outbox_events` dùng để publish Kafka an toàn sau khi transaction thay đổi đơn hoàn tất. Mã `orders.order_code` hiển thị cho khách là chuỗi, còn `payment_attempts.provider_order_code` là số nguyên duy nhất theo hợp đồng PayOS.

~~~sql
CREATE TABLE carts (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE cart_items (
    id UUID PRIMARY KEY,
    cart_id UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
    product_id UUID NOT NULL,
    variant_id UUID NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    selected BOOLEAN NOT NULL DEFAULT true,
    added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (cart_id, variant_id)
);
CREATE INDEX ix_cart_items_cart ON cart_items (cart_id);

CREATE TABLE orders (
    id UUID PRIMARY KEY,
    order_code VARCHAR(40) NOT NULL UNIQUE,
    user_id UUID NOT NULL,
    checkout_id UUID NOT NULL UNIQUE,
    idempotency_key VARCHAR(120) NOT NULL,
    status VARCHAR(12) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN (
            'PENDING', 'CONFIRMED', 'PROCESSING',
            'SHIPPING', 'DELIVERED', 'CANCELLED'
        )),
    payment_method VARCHAR(20) NOT NULL DEFAULT 'COD'
        CHECK (payment_method IN ('COD', 'PAYOS')),
    payment_status VARCHAR(12) NOT NULL
        CHECK (payment_status IN (
            'UNPAID', 'PENDING', 'PAID', 'FAILED', 'CANCELLED', 'EXPIRED'
        )),
    shipping_address JSONB NOT NULL
        CHECK (jsonb_typeof(shipping_address) = 'object'),
    subtotal BIGINT NOT NULL CHECK (subtotal >= 0),
    shipping_fee BIGINT NOT NULL CHECK (shipping_fee >= 0),
    discount_amount BIGINT NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
    total_amount BIGINT NOT NULL CHECK (total_amount >= 0),
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, idempotency_key),
    CHECK (total_amount = subtotal + shipping_fee - discount_amount),
    CHECK (
        (payment_method = 'COD' AND payment_status IN ('UNPAID', 'PAID', 'CANCELLED'))
        OR (payment_method = 'PAYOS' AND payment_status <> 'UNPAID')
    )
);
CREATE INDEX ix_orders_user_time ON orders (user_id, created_at DESC);
CREATE INDEX ix_orders_status_time ON orders (status, created_at DESC);
CREATE INDEX ix_orders_payment_status_time ON orders (payment_status, created_at DESC);

CREATE TABLE order_items (
    id UUID PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL,
    variant_id UUID NOT NULL,
    product_name VARCHAR(250) NOT NULL,
    sku VARCHAR(80) NOT NULL,
    image_url TEXT,
    size VARCHAR(40) NOT NULL,
    color VARCHAR(80) NOT NULL,
    unit_price BIGINT NOT NULL CHECK (unit_price >= 0),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    line_total BIGINT NOT NULL CHECK (line_total >= 0),
    CHECK (line_total = unit_price * quantity)
);
CREATE INDEX ix_order_items_order ON order_items (order_id);

CREATE TABLE payment_attempts (
    id UUID PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES orders(id),
    provider VARCHAR(12) NOT NULL DEFAULT 'PAYOS' CHECK (provider = 'PAYOS'),
    provider_order_code BIGINT NOT NULL UNIQUE CHECK (provider_order_code > 0),
    payment_link_id VARCHAR(120) UNIQUE,
    checkout_url TEXT,
    amount BIGINT NOT NULL CHECK (amount > 0),
    status VARCHAR(12) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'PAID', 'FAILED', 'CANCELLED', 'EXPIRED')),
    expires_at TIMESTAMPTZ NOT NULL,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (status <> 'PAID' OR paid_at IS NOT NULL)
);
CREATE INDEX ix_payment_attempts_order_time
    ON payment_attempts (order_id, created_at DESC);
CREATE UNIQUE INDEX ux_payment_attempts_active_order
    ON payment_attempts (order_id) WHERE status = 'PENDING';

CREATE TABLE payment_webhook_events (
    id UUID PRIMARY KEY,
    payment_attempt_id UUID NOT NULL REFERENCES payment_attempts(id),
    payload_sha256 CHAR(64) NOT NULL UNIQUE,
    provider_reference VARCHAR(120),
    payload JSONB NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
    received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at TIMESTAMPTZ,
    processing_error TEXT
);
CREATE INDEX ix_payment_webhook_events_attempt_time
    ON payment_webhook_events (payment_attempt_id, received_at DESC);

CREATE TABLE payment_status_history (
    id UUID PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES orders(id),
    payment_attempt_id UUID REFERENCES payment_attempts(id),
    previous_status VARCHAR(12),
    status VARCHAR(12) NOT NULL
        CHECK (status IN ('UNPAID', 'PENDING', 'PAID', 'FAILED', 'CANCELLED', 'EXPIRED')),
    reason VARCHAR(120),
    changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_payment_status_history_order_time
    ON payment_status_history (order_id, changed_at DESC);

CREATE TABLE order_status_history (
    id UUID PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    status VARCHAR(12) NOT NULL
        CHECK (status IN (
            'PENDING', 'CONFIRMED', 'PROCESSING',
            'SHIPPING', 'DELIVERED', 'CANCELLED'
        )),
    actor_id UUID,
    actor_role VARCHAR(10)
        CHECK (actor_role IN ('USER', 'ADMIN', 'SYSTEM')),
    changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_order_status_history_order_time
    ON order_status_history (order_id, changed_at);

CREATE TABLE outbox_events (
    id UUID PRIMARY KEY,
    aggregate_id UUID NOT NULL,
    event_type VARCHAR(80) NOT NULL,
    payload JSONB NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    published_at TIMESTAMPTZ,
    publish_attempts INTEGER NOT NULL DEFAULT 0 CHECK (publish_attempts >= 0)
);
CREATE INDEX ix_outbox_events_pending
    ON outbox_events (created_at) WHERE published_at IS NULL;
~~~

Ví dụ truy vấn báo cáo giá trị đơn đã giao và phần đã thu trong số đó, dùng trong dashboard của Order service. Với COD, cần ghi nhận thu tiền bằng nghiệp vụ riêng sau giao hàng. Tổng tiền đã thu toàn hệ thống phải tính cả đơn PayOS đã trả tiền nhưng chưa giao:

~~~sql
SELECT date_trunc('day', created_at) AS order_day,
       COUNT(*) AS delivered_orders,
       SUM(total_amount) AS delivered_value_vnd,
       COALESCE(SUM(total_amount) FILTER (WHERE payment_status = 'PAID'), 0)
           AS collected_delivered_vnd
FROM orders
WHERE status = 'DELIVERED'
GROUP BY date_trunc('day', created_at)
ORDER BY order_day DESC;

SELECT COUNT(*) AS paid_orders,
       COALESCE(SUM(total_amount), 0) AS collected_vnd
FROM orders
WHERE payment_status = 'PAID';
~~~

### 3.4. Notification service — database fashion_notification

Notification nhận sự kiện từ Kafka, dựng nội dung từ template, lưu yêu cầu gửi và lịch sử gửi. Email/SMS là **chức năng dự kiến**, chưa có provider hay luồng gửi trong code hiện tại. Bảng processed_events hỗ trợ idempotency khi Kafka phát lại.

~~~sql
CREATE TABLE notification_templates (
    id UUID PRIMARY KEY,
    code VARCHAR(80) NOT NULL,
    channel VARCHAR(10) NOT NULL
        CHECK (channel IN ('EMAIL', 'SMS', 'IN_APP')),
    subject VARCHAR(250),
    body TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (code, channel)
);

CREATE TABLE processed_events (
    event_id UUID PRIMARY KEY,
    event_type VARCHAR(80) NOT NULL,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE notifications (
    id UUID PRIMARY KEY,
    event_id UUID NOT NULL REFERENCES processed_events(event_id),
    template_id UUID REFERENCES notification_templates(id) ON DELETE SET NULL,
    recipient_user_id UUID NOT NULL,
    order_id UUID,
    channel VARCHAR(10) NOT NULL
        CHECK (channel IN ('EMAIL', 'SMS', 'IN_APP')),
    destination VARCHAR(255) NOT NULL,
    subject VARCHAR(250),
    body TEXT NOT NULL,
    status VARCHAR(12) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'SENT', 'FAILED')),
    attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
    next_attempt_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (event_id, recipient_user_id, channel)
);
CREATE INDEX ix_notifications_pending
    ON notifications (next_attempt_at, created_at)
    WHERE status IN ('PENDING', 'FAILED');
CREATE INDEX ix_notifications_recipient
    ON notifications (recipient_user_id, created_at DESC);

CREATE TABLE notification_attempts (
    id UUID PRIMARY KEY,
    notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
    attempted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    success BOOLEAN NOT NULL,
    provider_message_id VARCHAR(255),
    error_message TEXT
);
CREATE INDEX ix_notification_attempts_notification
    ON notification_attempts (notification_id, attempted_at DESC);
~~~

### 3.5. AI service — database fashion_ai

knowledge_documents và knowledge_chunks phục vụ quản trị tri thức và retrieval. Embedding dùng mảng DOUBLE PRECISION để DDL chạy trên PostgreSQL chuẩn; phương án này chỉ phù hợp dữ liệu nhỏ. Khi triển khai RAG thực với lượng tài liệu lớn, nên chọn pgvector và migration riêng theo kích thước embedding của model. Không giả định chatbot mock hiện nay đã dùng các bảng này.

~~~sql
CREATE TABLE knowledge_documents (
    id UUID PRIMARY KEY,
    title VARCHAR(250) NOT NULL,
    content TEXT NOT NULL,
    status VARCHAR(10) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'INDEXED', 'FAILED')),
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_knowledge_documents_status
    ON knowledge_documents (status, updated_at DESC);

CREATE TABLE knowledge_chunks (
    id UUID PRIMARY KEY,
    document_id UUID NOT NULL
        REFERENCES knowledge_documents(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL CHECK (chunk_index >= 0),
    content TEXT NOT NULL,
    embedding_model VARCHAR(120),
    embedding DOUBLE PRECISION[],
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (document_id, chunk_index),
    CHECK (embedding IS NULL OR cardinality(embedding) > 0)
);
CREATE INDEX ix_knowledge_chunks_document
    ON knowledge_chunks (document_id, chunk_index);

CREATE TABLE conversations (
    id UUID PRIMARY KEY,
    user_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_conversations_user_time
    ON conversations (user_id, updated_at DESC);

CREATE TABLE chat_messages (
    id UUID PRIMARY KEY,
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role VARCHAR(10) NOT NULL CHECK (role IN ('USER', 'ASSISTANT')),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_chat_messages_conversation_time
    ON chat_messages (conversation_id, created_at);

CREATE TABLE chat_message_sources (
    id UUID PRIMARY KEY,
    message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
    document_id UUID REFERENCES knowledge_documents(id) ON DELETE SET NULL,
    chunk_id UUID REFERENCES knowledge_chunks(id) ON DELETE SET NULL,
    title VARCHAR(250) NOT NULL,
    excerpt TEXT,
    relevance_score DOUBLE PRECISION
        CHECK (relevance_score IS NULL OR relevance_score BETWEEN 0 AND 1),
    source_url TEXT
);
CREATE INDEX ix_chat_message_sources_message
    ON chat_message_sources (message_id);

CREATE TABLE chat_message_product_suggestions (
    message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
    product_id UUID NOT NULL,
    position INTEGER NOT NULL CHECK (position >= 0),
    PRIMARY KEY (message_id, product_id),
    UNIQUE (message_id, position)
);
~~~

Nguồn trích dẫn lưu title/excerpt tại thời điểm trả lời; khi xóa tài liệu tri thức, lịch sử chat vẫn giữ được phần nguồn đã hiển thị. Product ID gợi ý là tham chiếu sang Catalog, không có foreign key xuyên database.

## 4. API và quyền truy cập dự kiến

Prefix bên ngoài Gateway là /api/v1. Response đề xuất theo frontend/API_CONTRACT.md: ApiResponse<T> gồm success, data, message, timestamp; danh sách phân trang dùng PageResponse<T> trong data. Lỗi trả code, message và details khi cần. Không trả password_hash, token_hash hoặc thông tin nội bộ trong API response.

| Service | Nhóm endpoint | Quyền | Trạng thái frontend/backend |
| --- | --- | --- | --- |
| Auth | POST /auth/register, /auth/login, /auth/logout, /auth/refresh | Public hoặc phiên hiện tại | Register/login/logout có mock; refresh chưa nối UI; backend chưa có. |
| Auth | GET/PUT /users/me; CRUD /users/me/addresses | USER/ADMIN | Hồ sơ và địa chỉ có giao diện; địa chỉ còn local. |
| Catalog | GET /products, /products/slug/{slug}, /categories | Public | Giao diện/mocks có; backend chưa có. |
| Catalog | CRUD /admin/products, /admin/categories; GET/PATCH /admin/inventory | ADMIN | Giao diện admin có; API inventory/categories chưa tích hợp. |
| Catalog | GET/POST/DELETE /wishlist | USER/ADMIN | Đề xuất cho API mode; hiện lưu local, khách chưa đăng nhập cũng có thể dùng local. |
| Order | GET/POST/PATCH/DELETE /cart/items | USER/ADMIN | Đề xuất cho API mode; hiện lưu local. |
| Order | POST /orders, GET /orders/my, GET /orders/{id}, PATCH /orders/{id}/cancel | USER/ADMIN, chỉ đơn của mình | UI COD có; backend chưa có. POST nhận `paymentMethod: COD/PAYOS`; khi chọn PayOS trả `checkoutUrl` và trạng thái để frontend chuyển hướng. Khách không tự hủy đơn PayOS đã PAID trong MVP. |
| Order | GET /orders/{id}/payment | USER/ADMIN, chỉ đơn của mình | Đề xuất để trang trở về từ PayOS tải trạng thái thật từ backend; chưa có UI/backend. |
| Order | POST /payments/payos/webhook | Public tại Gateway; xác thực chữ ký PayOS tại Order | Đề xuất; không yêu cầu JWT người dùng. Xác minh chữ ký và đối chiếu mã, link, số tiền trước khi cập nhật idempotent; chưa có backend. |
| Order | GET /admin/orders, PATCH /admin/orders/{id}/status, GET /admin/statistics | ADMIN | UI có; backend chưa có. |
| AI | POST /chat, GET /chat/conversations[/{id}] | Public/USER tùy chính sách lưu hội thoại | Chat mock có; lưu hội thoại server chưa có. |
| AI | GET/POST/PUT/DELETE /admin/knowledge[/{id}], GET /admin/ai-conversations | ADMIN | Giao diện có; backend chưa có. |
| Notification | Không mở endpoint public trong MVP | Nội bộ | Chưa tích hợp. |

**Lưu ý hợp đồng:** frontend hiện gọi PATCH /admin/orders/{id}/status cả khi khách tự hủy trong API mode. Khi triển khai backend, phải sửa frontend sang PATCH /orders/{id}/cancel và kiểm tra user_id ở server. Model frontend hiện còn `MOCK_PAYMENT`; cần thay bằng `PAYOS` và hiển thị kết quả qua API. Gateway phải bổ sung route `/api/v1/payments/payos/webhook` và `/api/v1/orders/{id}/payment`; các route khác cũng chưa bao phủ toàn bộ bảng trên. Endpoint quản trị người dùng chỉ cần GET /admin/users cho giao diện hiện tại; khóa tài khoản/phân quyền là chức năng mở rộng, chưa có UI.

## 5. Kafka và tính nhất quán

| Topic đề xuất | Producer | Consumer | Payload tối thiểu |
| --- | --- | --- | --- |
| fashion.order.created.v1 | Order | Notification, báo cáo/read model sau này | eventId, orderId, userId, orderCode, totalAmount, createdAt |
| fashion.order.status-changed.v1 | Order | Notification, Catalog khi cần | eventId, orderId, userId, previousStatus, status, changedAt |
| fashion.order.cancelled.v1 | Order | Catalog, Notification | eventId, orderId, userId, checkoutId, cancelledAt |
| fashion.payment.paid.v1 | Order | Notification, báo cáo/read model sau này | eventId, orderId, userId, paymentAttemptId, amount, paidAt |

- eventId là UUID ổn định để consumer chống xử lý trùng. Version ở tên topic và payload giúp nâng cấp hợp đồng.
- Order ghi outbox và thay đổi đơn trong cùng transaction. Worker publish outbox lên Kafka và đánh dấu published_at; consumer phải chấp nhận sự kiện đến lại hoặc không đúng thứ tự.
- PayOS webhook có thể được gửi lại; Order lưu dấu webhook, khóa giao dịch khi xử lý và chỉ phát `fashion.payment.paid.v1` một lần cho một lần thanh toán đã xác nhận. Không đưa khóa API, signature hoặc payload ngân hàng thô vào Kafka.
- Catalog sử dụng checkout_id/reservation_id và inventory_movements để tránh trừ/hoàn tồn hai lần. Notification dùng processed_events và ghi hàng đợi thông báo trong cùng transaction xử lý sự kiện.
- Không đặt dữ liệu cá nhân nhạy cảm hoặc password/token trong event. Notification lấy địa chỉ email/phone qua Auth service hoặc dữ liệu cho phép được truyền có kiểm soát; chính sách này cần chốt trước khi triển khai.

## 6. Bảo mật, dữ liệu và vận hành

1. Auth phát token có user_id, role và hạn dùng; Gateway và từng service nhạy cảm xác minh token. Backend luôn kiểm tra quyền ADMIN và quyền sở hữu đơn/địa chỉ, không dựa vào ProtectedRoute của React.
2. Mật khẩu băm bằng Argon2id hoặc BCrypt với salt; refresh/reset token chỉ lưu hash, có hạn và thu hồi được. Secret lấy từ biến môi trường hoặc secret manager, không commit.
3. Validate email, số điện thoại, số lượng, trạng thái, độ dài chuỗi ở API. Không cho đặt số lượng âm hoặc vượt tồn; không lấy giá từ client.
4. Chỉ Catalog được cập nhật tồn kho. Order không ghi trực tiếp vào database Catalog. Cập nhật trạng thái cần kiểm tra transition và chống ghi đè đồng thời.
5. Dùng migration có version, backup riêng theo database và index cho truy vấn trang danh sách. Dùng tracing/correlation ID qua Gateway, service và Kafka.
6. Hạn chế truy cập CSDL theo service; kết nối TLS và phân quyền trong môi trường triển khai. Không dùng tài khoản PostgreSQL quản trị cho ứng dụng.
7. Khóa PayOS (`clientId`, `apiKey`, `checksumKey`) lấy từ biến môi trường/secret manager. Webhook phải được xác minh chữ ký theo SDK/hợp đồng PayOS rồi đối chiếu `orderCode`, `paymentLinkId` và số tiền với bản ghi nội bộ. Không coi `returnUrl`, `cancelUrl` hay dữ liệu frontend là xác nhận thanh toán. Lưu webhook để truy vết, che dữ liệu nhạy cảm và xử lý lặp an toàn.
8. Đặt thời hạn link và reservation đồng bộ; tác vụ định kỳ kiểm tra các giao dịch chờ quá hạn với PayOS trước khi hủy/hoàn tồn. Theo dõi webhook lỗi, thanh toán đã nhận nhưng đơn chưa xác nhận và đối soát thủ công khi có sai lệch.

## 7. Thứ tự triển khai đề xuất

1. Chốt hợp đồng API và ownership trong tài liệu này; thêm route Gateway còn thiếu.
2. Tạo 5 database, tách migration và cấu hình datasource của từng service. DDL ở mục 3 là bản thiết kế khởi đầu, chưa được áp dụng tự động.
3. Hoàn thiện Auth, Catalog và Order với kiểm thử phân quyền, tính tiền, đặt giữ tồn và idempotency.
4. Tích hợp PayOS trong Order: cấu hình bí mật, tạo link, webhook xác thực/idempotent, hết hạn/đối soát và kiểm thử luồng thành công, thất bại, hủy, webhook lặp và webhook đến trễ.
5. Nối frontend sang API mode từng nhóm màn hình; bổ sung lựa chọn PayOS và trang kết quả tải trạng thái từ Order, thay localStorage cho giỏ hàng/yêu thích/địa chỉ nếu muốn đồng bộ đa thiết bị.
6. Thêm outbox/Kafka và Notification; xác nhận provider gửi, retry và quan sát lỗi.
7. Hoàn thiện AI ingestion/retrieval, quản trị tri thức và truy xuất nguồn; chỉ gọi là RAG thực sau khi có embeddings và kiểm thử chất lượng câu trả lời.
8. Bổ sung CI migration, kiểm thử tích hợp giữa service và dữ liệu seed cho môi trường demo.

## 8. Nguồn đối chiếu trong repository

- [Yêu cầu và danh sách trang frontend](../../frontend/implement.md)
- [Route đang có](../../frontend/src/app/App.tsx)
- [Model dữ liệu](../../frontend/src/types/models.ts)
- [Hợp đồng API dự kiến](../../frontend/API_CONTRACT.md)
- [Mô tả frontend và giới hạn mock](../../frontend/README.md)
- [Biểu đồ use case tổng quan](../uml/use-case-overview.md)
- [Cấu hình Gateway hiện tại](../../backend/api-gateway/src/main/resources/application.properties)
- [Docker Compose phát triển](../../infrastructure/docker/compose.dev.yaml)
- [PayOS API tạo link và webhook](https://payos.vn/docs/api/)
- [PayOS webhook](https://payos.vn/docs/du-lieu-tra-ve/webhook/)
- [PayOS return URL](https://payos.vn/docs/du-lieu-tra-ve/return-url/)
