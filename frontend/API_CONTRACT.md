# API Contract đề xuất

Base URL: `${VITE_API_BASE_URL}` (ví dụ `http://localhost:8080/api/v1`). Đây là bản thiết kế phía Frontend; cần thống nhất và thử lại với các Quarkus service. Các response dưới đây bọc trong `ApiResponse<T> = { success: boolean, data: T, message?: string, timestamp?: string }`. Danh sách phân trang dùng `PageResponse<T> = { content, page, size, totalElements, totalPages, last }` trong `data`. Lỗi dự kiến: `{ code, message, details? }` với HTTP 400/401/403/404/409/500.

| Service | Method | Endpoint | Request | `data` response | Trang dùng | Trạng thái |
| --- | --- | --- | --- | --- | --- | --- |
| Auth | POST | `/auth/login` | `{ email, password }` | `{ user: User, accessToken? }` | Login | Mock; chưa xác nhận Backend |
| Auth | POST | `/auth/register` | `{ fullName, email, phone, password }` | `User` | Register | Mock; chưa xác nhận Backend |
| Auth | POST | `/auth/logout` | Cookie/token | Rỗng | Header | Mock; chưa xác nhận Backend |
| User | GET | `/users/me` | Token | `User` | Account | Chưa tích hợp |
| User | PUT | `/users/me` | `Partial<User>` | `User` | Profile | Mock; chưa xác nhận Backend |
| Catalog | GET | `/products` | `category,q,minPrice,maxPrice,size,color,sort,page,limit` | `PageResponse<Product>` | Home, catalog, search | Mock; chưa xác nhận Backend |
| Catalog | GET | `/products/slug/{slug}` | Path slug | `Product` | Detail | Mock; chưa xác nhận Backend |
| Catalog | GET | `/products/{id}` | Path id | `Product` | Admin, orders | Mock; chưa xác nhận Backend |
| Catalog | GET | `/categories` | — | `Category[]` | Header, catalog | Mock; chưa xác nhận Backend |
| Admin | POST/PUT/DELETE | `/admin/categories[/{id}]` | `Category` hoặc path id | `Category`/rỗng | Category management | Chỉ mock; cần xác nhận Backend |
| Order | POST | `/orders` | `{ items: [{variantId,quantity}], shippingAddress, paymentMethod:'COD', note? }` | `Order` | Checkout | Mock; chưa xác nhận Backend |
| Order | GET | `/orders/my` | Token | `Order[]` | Order history | Mock; chưa xác nhận Backend |
| Order | GET | `/orders/{id}` | Path id | `Order` | Success, detail | Mock; chưa xác nhận Backend |
| Admin | GET | `/admin/products` | Query | `PageResponse<Product>` | Product management | Mock; chưa xác nhận Backend |
| Admin | POST | `/admin/products` | `Product` | `Product` | Create product | Mock; chưa xác nhận Backend |
| Admin | PUT | `/admin/products/{id}` | `Product` | `Product` | Edit product | Mock; chưa xác nhận Backend |
| Admin | DELETE | `/admin/products/{id}` | Path id | Rỗng | Product management | Mock; chưa xác nhận Backend |
| Admin | GET | `/admin/orders` | Query | `Order[]` | Orders, dashboard | Mock; chưa xác nhận Backend |
| Admin | PATCH | `/admin/orders/{id}/status` | `{ status: OrderStatus }` | `Order` | Admin order detail | Mock; chưa xác nhận Backend |
| AI/RAG | POST | `/chat` | `{ message, conversationId }` | `ChatMessage` | Chatbot | Rule-based mock; chưa xác nhận Backend |
| AI/RAG | GET | `/admin/knowledge` | Token | `KnowledgeDocument[]` | Knowledge admin | Mock; chưa xác nhận Backend |
| AI/RAG | POST | `/admin/knowledge` | `KnowledgeDocument` | `KnowledgeDocument` | Knowledge admin | Mock; chưa xác nhận Backend |
| AI/RAG | DELETE | `/admin/knowledge/{id}` | Path id | Rỗng | Knowledge admin | Mock; chưa xác nhận Backend |

Backend cần kiểm tra quyền, tính lại giá/tồn kho khi tạo đơn, và trả trạng thái sau xử lý bất đồng bộ. Frontend refetch đơn đang chờ/đang xử lý sau 15 giây. Các API cart, địa chỉ, người dùng, thống kê và quản lý tồn kho cần thống nhất thêm trước khi chuyển hoàn toàn sang API mode.
