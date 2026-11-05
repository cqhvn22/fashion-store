# VAI TRÒ VÀ MỤC TIÊU

Bạn là Senior Frontend Engineer có kinh nghiệm xây dựng hệ thống thương mại điện tử bằng React, TypeScript và tích hợp Backend Microservices.

Hãy xây dựng TOÀN BỘ FRONTEND cho đề tài:

**"Xây dựng ứng dụng web bán thời trang theo kiến trúc Microservices tích hợp AI/RAG"**

Đây là đồ án sinh viên ngành Công nghệ thông tin, nhưng chất lượng mã nguồn cần hướng tới một dự án phần mềm thực tế, có cấu trúc rõ ràng, dễ đọc, dễ bảo trì, dễ mở rộng và dễ tích hợp Backend.

Frontend cần hoàn chỉnh ở mức có thể sử dụng để demo toàn bộ luồng mua hàng, quản trị và chatbot, đồng thời có kiến trúc sẵn sàng kết nối với hệ thống Spring Boot Microservices thông qua API Gateway.

**Yêu cầu quan trọng nhất:**

- Không code theo phong cách vibe coding thiếu cấu trúc.
- Không tạo giao diện chỉ để xem mà thiếu luồng tương tác.
- Không hardcode dữ liệu nghiệp vụ trực tiếp vào JSX.
- Không viết toàn bộ ứng dụng trong App.tsx.
- Không gộp logic gọi API, xử lý nghiệp vụ và hiển thị UI vào một component.
- Không tạo ra các nút bấm giả, chức năng giả hoặc các liên kết không hoạt động mà không giải thích.
- Không lạm dụng hiệu ứng, gradient, glassmorphism và animation.
- Không sử dụng dữ liệu có cấu trúc tùy tiện, thiếu thống nhất.
- Mỗi trang phải có loading, error, empty state khi phù hợp.
- Toàn bộ dữ liệu mẫu phải tuân theo cấu trúc rõ ràng để thay thế bằng REST API sau này.

# I. CÔNG NGHỆ BẮT BUỘC

Sử dụng:

- React với TypeScript.
- Vite để khởi tạo và build dự án.
- React Router để quản lý routing.
- Tailwind CSS để xây dựng giao diện.
- TanStack Query để quản lý server state, caching và refetch.
- Axios để gọi REST API.
- React Hook Form và Zod để quản lý, kiểm tra biểu mẫu.
- Zustand hoặc React Context cho trạng thái client cần chia sẻ như giỏ hàng và authentication.
- Lucide React cho icon.
- Recharts cho biểu đồ thống kê quản trị.
- ESLint và Prettier để thống nhất code style.

Ưu tiên sử dụng HTML semantic, CSS/Tailwind đơn giản và các component tự xây dựng. Có thể dùng thư viện UI khi thực sự cần thiết, nhưng không phụ thuộc quá nhiều vào các component tạo sẵn khiến toàn bộ hệ thống mang vẻ ngoài của một dashboard template.

Không sử dụng Next.js. Đây là dự án React SPA.

# II. PHONG CÁCH THIẾT KẾ

Thiết kế giao diện theo phong cách website thương mại điện tử tương tự Shopee, nhưng có bộ nhận diện riêng, ví dụ FashionHub.

## 2.1. Màu sắc

- Primary: #EE4D2D
- Primary hover: #D94325
- Background: #F5F5F5
- Surface: #FFFFFF
- Text primary: #222222
- Text secondary: #757575
- Border: #E5E5E5
- Success: #16A34A
- Warning: #F59E0B
- Error: #DC2626

Có thể điều chỉnh màu để tăng tính thẩm mỹ, nhưng phải nhất quán trên tất cả trang.

## 2.2. Giao diện tổng thể

Thiết kế theo hướng:

- Header có logo, thanh tìm kiếm, tài khoản và giỏ hàng.
- Thanh điều hướng danh mục.
- Banner quảng cáo trên trang chủ.
- Các khối danh mục sản phẩm.
- Khu vực sản phẩm nổi bật, sản phẩm mới và sản phẩm bán chạy.
- Lưới sản phẩm có ảnh lớn, giá, giá gốc, phần trăm giảm và đánh giá.
- Footer đầy đủ thông tin cửa hàng, chính sách, hỗ trợ.
- Chatbot nổi ở góc dưới bên phải.
- Responsive cho desktop, tablet và mobile.

Không sao chép nguyên bản hình ảnh, logo, tên thương hiệu hoặc bố cục độc quyền của Shopee.

Ưu tiên giao diện mua sắm trực quan, mật độ thông tin hợp lý và thao tác nhanh.

## 2.3. Quy chuẩn UI

- Dùng hệ thống spacing nhất quán.
- Font chữ dễ đọc, ưu tiên Inter hoặc system font.
- Không sử dụng quá nhiều kiểu chữ và cỡ chữ.
- Border radius vừa phải, không bo tròn tất cả thành phần quá mức.
- Shadow nhẹ, không dùng đổ bóng dày đặc.
- Icon nhất quán.
- Hover state và focus state rõ ràng.
- Có skeleton loading cho danh sách sản phẩm.
- Toast cho thông báo thành công hoặc thất bại.
- Modal xác nhận cho các hành động quan trọng.
- Phân trang hoặc tải thêm đối với danh sách dài.
- Có khả năng truy cập bằng bàn phím và nhãn phù hợp cho form.

# III. CẤU TRÚC DỰ ÁN

Tổ chức source code theo feature-based architecture, kết hợp phân tách các tầng API và UI.

Cấu trúc tham khảo:

src/
  app/
    App.tsx
    router/
      index.tsx
      ProtectedRoute.tsx
      AdminRoute.tsx
    providers/
      QueryProvider.tsx
      AuthProvider.tsx

  assets/
    images/
    icons/

  components/
    common/
      Button/
      Input/
      Modal/
      Pagination/
      EmptyState/
      ErrorState/
      LoadingSkeleton/
      ConfirmDialog/
    layout/
      Header/
      Footer/
      Navbar/
      MainLayout/
      AuthLayout/
      AdminLayout/
    product/
      ProductCard/
      ProductGrid/
      ProductFilter/
      ProductGallery/
      ProductVariantSelector/
    cart/
      CartItem/
      CartSummary/
    chatbot/
      ChatWidget/
      ChatMessage/
      ChatSource/

  features/
    auth/
      api/
      components/
      hooks/
      pages/
      types/
      schemas/
    products/
      api/
      components/
      hooks/
      pages/
      types/
    categories/
    cart/
    orders/
    user/
    admin/
    ai-chat/

  services/
    httpClient.ts
    apiConfig.ts

  mocks/
    data/
      products.ts
      categories.ts
      users.ts
      orders.ts
      conversations.ts
    handlers/
    mockServer.ts

  stores/
    authStore.ts
    cartStore.ts

  hooks/
  types/
  utils/
  constants/
  styles/
  tests/

Không bắt buộc tạo file trống cho mọi thư mục. Chỉ tạo cấu trúc cần thiết tương ứng với tính năng đã triển khai.

Mỗi feature phải có trách nhiệm rõ ràng. Các component dùng chung được đưa vào thư mục components.

# IV. DANH SÁCH TOÀN BỘ TRANG CẦN XÂY DỰNG

## 4.1. Trang dành cho khách hàng

### 1. Trang chủ — /

Cần có:

- Header, logo, thanh tìm kiếm và giỏ hàng.
- Banner quảng cáo có thể thay đổi.
- Danh mục sản phẩm.
- Sản phẩm nổi bật.
- Sản phẩm mới.
- Sản phẩm bán chạy.
- Khối sản phẩm giảm giá.
- Danh sách đề xuất.
- Footer và chatbot.

Dữ liệu sản phẩm phải lấy từ service/hook, không khai báo trực tiếp trong component trang chủ.

### 2. Trang danh sách sản phẩm — /products

Cần có:

- Danh sách sản phẩm dạng grid.
- Lọc theo danh mục.
- Lọc theo giá.
- Lọc theo kích cỡ.
- Lọc theo màu sắc.
- Sắp xếp theo giá tăng/giảm, mới nhất, bán chạy.
- Hiển thị số lượng kết quả.
- Phân trang.
- Đồng bộ bộ lọc với query parameters trên URL.

Ví dụ:

/products?category=ao-thun&minPrice=100000&maxPrice=500000&sort=price_asc&page=1

### 3. Trang chi tiết sản phẩm — /products/:slug

Có:

- Gallery nhiều ảnh sản phẩm.
- Tên, mô tả, giá, giá gốc và giảm giá.
- Đánh giá và số lượng đã bán.
- Lựa chọn màu sắc.
- Lựa chọn kích cỡ.
- Thông tin tồn kho của từng biến thể.
- Điều chỉnh số lượng.
- Thêm vào giỏ hàng.
- Mua ngay.
- Bảng hướng dẫn chọn size.
- Thông tin vận chuyển.
- Chính sách đổi trả.
- Sản phẩm liên quan.
- Đánh giá sản phẩm (nếu Backend hỗ trợ).

Không cho phép đặt số lượng vượt tồn kho hiển thị. Khi Checkout, Backend vẫn là nơi xác nhận tồn kho thực tế.

### 4. Trang tìm kiếm — /search

- Nhận từ khóa từ URL.
- Hiển thị kết quả tìm kiếm.
- Sắp xếp và lọc.
- Hiển thị thông báo khi không có sản phẩm phù hợp.
- Có gợi ý tìm kiếm nếu đã có dữ liệu hỗ trợ.

### 5. Trang danh mục — /categories/:slug

- Banner danh mục.
- Mô tả danh mục.
- Danh sách sản phẩm.
- Bộ lọc và sắp xếp.

### 6. Trang giỏ hàng — /cart

- Danh sách sản phẩm đã thêm.
- Ảnh, tên, kích cỡ, màu sắc, đơn giá.
- Điều chỉnh số lượng.
- Xóa sản phẩm.
- Chọn sản phẩm thanh toán.
- Tính tạm tính và tổng tiền dự kiến.
- Kiểm tra sản phẩm không còn tồn kho.
- Chuyển sang Checkout.

### 7. Trang thanh toán — /checkout

- Thông tin nhận hàng.
- Danh sách sản phẩm đặt mua.
- Địa chỉ và số điện thoại.
- Ghi chú đơn hàng.
- Phương thức thanh toán COD.
- Phí vận chuyển dự kiến.
- Tổng tiền dự kiến.
- Nút xác nhận đặt hàng.

Backend phải tính lại số tiền và kiểm tra tồn kho. Frontend không được tự quyết định giá trị thanh toán cuối cùng.

### 8. Trang đặt hàng thành công — /checkout/success/:orderId

- Thông báo kết quả.
- Mã đơn hàng.
- Số tiền.
- Hình thức thanh toán.
- Nút xem chi tiết đơn.
- Nút tiếp tục mua sắm.

### 9. Trang đăng nhập — /login

- Email hoặc thông tin đăng nhập phù hợp API.
- Mật khẩu.
- Hiện/ẩn mật khẩu.
- Validation.
- Thông báo lỗi.
- Link đăng ký và quên mật khẩu.

### 10. Trang đăng ký — /register

- Họ tên.
- Email.
- Số điện thoại.
- Mật khẩu.
- Xác nhận mật khẩu.
- Validation và thông báo lỗi.

### 11. Trang quên mật khẩu — /forgot-password

Thiết kế giao diện nhập email và thông báo gửi yêu cầu.

Nếu Backend chưa có API khôi phục mật khẩu thì dùng mock adapter, không giả vờ gửi email thật.

### 12. Trang tài khoản — /account/profile

- Thông tin cá nhân.
- Chỉnh sửa họ tên, số điện thoại.
- Đổi mật khẩu.
- Cập nhật thông tin người dùng.

### 13. Trang địa chỉ — /account/addresses

- Danh sách địa chỉ.
- Thêm, sửa, xóa địa chỉ.
- Chọn địa chỉ mặc định.

### 14. Trang lịch sử đơn hàng — /account/orders

- Danh sách đơn.
- Lọc theo trạng thái.
- Mã đơn, ngày đặt, tổng tiền.
- Xem chi tiết đơn.
- Hủy đơn nếu trạng thái cho phép.

### 15. Trang chi tiết đơn hàng — /account/orders/:orderId

- Thông tin đơn.
- Sản phẩm đã mua.
- Địa chỉ giao hàng.
- Phương thức thanh toán.
- Lịch sử trạng thái.
- Tổng tiền và các khoản phí.
- Trạng thái xử lý.

### 16. Trang yêu thích — /wishlist

- Sản phẩm đã lưu.
- Xóa khỏi yêu thích.
- Thêm vào giỏ hàng.

Triển khai bằng local state/mock trước nếu Backend chưa có API tương ứng. Không coi dữ liệu local là dữ liệu đồng bộ với server.

### 17. Trang chatbot AI — /ai-assistant

- Giao diện hội thoại.
- Danh sách tin nhắn.
- Câu hỏi gợi ý.
- Hiển thị nguồn tham khảo.
- Trạng thái đang trả lời.
- Thông báo khi không có đủ dữ liệu.
- Nút mở sản phẩm được AI đề xuất.

Chatbot nổi ở mọi trang sử dụng lại các component của trang này.

### 18. Các trang thông tin

- /about
- /contact
- /policies/shipping
- /policies/returns
- /policies/privacy
- /size-guide

### 19. Trang lỗi

- /403
- /404
- /500

# V. TOÀN BỘ TRANG ADMIN

Admin phải có layout riêng với sidebar, header và khu vực nội dung.

## 5.1. Dashboard — /admin

Hiển thị:

- Tổng số sản phẩm.
- Tổng đơn hàng.
- Đơn hàng chờ xử lý.
- Doanh thu demo.
- Biểu đồ doanh thu.
- Đơn hàng gần đây.
- Sản phẩm sắp hết hàng.

Sử dụng dữ liệu thống kê có cấu trúc API rõ ràng. Không tự tính toàn bộ doanh thu từ vài sản phẩm mock rồi trình bày như dữ liệu thực tế.

## 5.2. Quản lý sản phẩm — /admin/products

- Danh sách sản phẩm.
- Tìm kiếm.
- Lọc trạng thái.
- Phân trang.
- Thêm sản phẩm.
- Sửa sản phẩm.
- Xóa hoặc ngừng kinh doanh.
- Quản lý ảnh.
- Quản lý biến thể.

Các route:

/admin/products
/admin/products/create
/admin/products/:id/edit

## 5.3. Quản lý danh mục — /admin/categories

- Danh sách danh mục.
- Thêm, sửa, xóa.
- Danh mục cha/con nếu API hỗ trợ.

## 5.4. Quản lý biến thể và tồn kho — /admin/inventory

- Danh sách SKU.
- Tên sản phẩm.
- Size.
- Màu sắc.
- Số lượng tồn.
- Số lượng đang giữ chỗ nếu Backend hỗ trợ.
- Cảnh báo tồn kho thấp.
- Cập nhật hoặc điều chỉnh tồn kho thông qua API riêng.

## 5.5. Quản lý đơn hàng — /admin/orders

- Danh sách đơn hàng.
- Lọc theo trạng thái.
- Tìm theo mã đơn.
- Xem chi tiết.
- Cập nhật trạng thái theo quy tắc nghiệp vụ.
- Xem lịch sử xử lý đơn.

Các route:

/admin/orders
/admin/orders/:orderId

## 5.6. Quản lý người dùng — /admin/users

- Danh sách người dùng.
- Tìm kiếm.
- Chi tiết người dùng.
- Trạng thái tài khoản.
- Vai trò.
- Các thao tác quản trị khi được Backend cho phép.

## 5.7. Quản lý kho tri thức AI — /admin/knowledge

- Danh sách tài liệu.
- Thêm tài liệu.
- Chỉnh sửa metadata.
- Xóa tài liệu.
- Xem trạng thái indexing.
- Yêu cầu đồng bộ lại dữ liệu.
- Thống kê tài liệu đã lập chỉ mục.

## 5.8. Quản lý hội thoại AI — /admin/ai-conversations

- Danh sách hội thoại theo quyền được cấp.
- Bộ lọc thời gian/trạng thái.
- Chi tiết lịch sử nếu Backend cho phép.
- Thống kê câu hỏi không trả lời được.

Không hiển thị dữ liệu hội thoại cá nhân nếu API không cấp quyền.

## 5.9. Báo cáo thống kê — /admin/reports

- Doanh thu theo thời gian.
- Số lượng đơn.
- Trạng thái đơn.
- Sản phẩm bán chạy.
- Sản phẩm tồn kho thấp.

## 5.10. Các chức năng mở rộng

Có thể chuẩn bị UI tách biệt cho:

- /admin/promotions
- /admin/reviews
- /admin/settings

Chỉ gắn nhãn "Chưa tích hợp Backend" hoặc sử dụng mock khi chức năng chưa nằm trong MVP.

# VI. THIẾT KẾ DỮ LIỆU CHUẨN ĐỂ KẾT NỐI API

Đây là phần cực kỳ quan trọng.

Mọi dữ liệu phải định nghĩa bằng TypeScript interface/type và có mock data tương ứng.

Không sử dụng kiểu any nếu không cần thiết.

## 6.1. Product

Ví dụ:

```ts
export interface Product {
  id: string;
  slug: string;
  name: string;
  description: string;
  categoryId: string;
  brand?: string;
  images: ProductImage[];
  variants: ProductVariant[];
  minPrice: number;
  maxPrice: number;
  originalPrice?: number;
  ratingAverage: number;
  reviewCount: number;
  soldCount: number;
  status: "ACTIVE" | "INACTIVE" | "DRAFT";
  createdAt: string;
  updatedAt: string;
}

export interface ProductImage {
  id: string;
  url: string;
  alt: string;
  isPrimary: boolean;
}

export interface ProductVariant {
  id: string;
  sku: string;
  color: string;
  colorCode?: string;
  size: string;
  price: number;
  stockQuantity: number;
  imageUrl?: string;
}
```

Giá tiền sử dụng VND nguyên, không biểu diễn dưới dạng chuỗi như "250.000đ" trong API.

Định dạng giá bằng utility riêng trên giao diện.

## 6.2. Category

```ts
export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  imageUrl?: string;
  parentId?: string | null;
  isActive: boolean;
}
```

## 6.3. User

```ts
export interface User {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  role: "USER" | "ADMIN";
  status: "ACTIVE" | "LOCKED";
  createdAt: string;
}
```

Không lưu mật khẩu hoặc password hash trong dữ liệu User frontend.

## 6.4. Cart

```ts
export interface CartItem {
  id: string;
  productId: string;
  variantId: string;
  productName: string;
  productSlug: string;
  imageUrl: string;
  size: string;
  color: string;
  unitPrice: number;
  quantity: number;
  availableStock?: number;
}
```

Giỏ hàng có thể lưu tạm ở localStorage trong Mock Mode. Khi chuyển sang API thật cần dùng CartRepository/CartService để thay thế.

## 6.5. Order

```ts
export type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "PROCESSING"
  | "SHIPPING"
  | "DELIVERED"
  | "CANCELLED";

export interface Order {
  id: string;
  orderCode: string;
  userId: string;
  items: OrderItem[];
  shippingAddress: Address;
  subtotal: number;
  shippingFee: number;
  discountAmount: number;
  totalAmount: number;
  paymentMethod: "COD" | "MOCK_PAYMENT";
  status: OrderStatus;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  id: string;
  productId: string;
  variantId: string;
  productName: string;
  sku: string;
  imageUrl: string;
  size: string;
  color: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface Address {
  id?: string;
  recipientName: string;
  phone: string;
  province: string;
  district: string;
  ward: string;
  detail: string;
}
```

## 6.6. AI Chat

```ts
export interface ChatSource {
  documentId: string;
  title: string;
  excerpt?: string;
  relevanceScore?: number;
  url?: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: "USER" | "ASSISTANT";
  content: string;
  sources?: ChatSource[];
  suggestedProductIds?: string[];
  createdAt: string;
}
```

## 6.7. API Response

```ts
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  timestamp?: string;
}

export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, string>;
}
```

Đây là hợp đồng API đề xuất cho Frontend, chưa phải hợp đồng Backend đã xác nhận.

Phải định nghĩa rõ response nào sử dụng ApiResponse và response nào là PageResponse.

Không tự viết code phụ thuộc vào những field không tồn tại trong interface.

# VII. TẠO MOCK DATA CÓ CẤU TRÚC

Phải có dữ liệu mẫu đầy đủ và nhất quán để tất cả trang hoạt động khi chưa có Backend.

Ví dụ sản phẩm:

```ts
export const mockProducts: Product[] = [
  {
    id: "prod-001",
    slug: "ao-thun-nam-basic-cotton",
    name: "Áo thun nam Basic Cotton",
    description: "Áo thun cotton mềm mại, phù hợp mặc hằng ngày.",
    categoryId: "cat-001",
    brand: "FashionHub",
    images: [
      {
        id: "img-001",
        url: "/mock/products/ao-thun-basic-1.jpg",
        alt: "Áo thun nam Basic Cotton màu trắng",
        isPrimary: true
      }
    ],
    variants: [
      {
        id: "var-001",
        sku: "AT-001-WHITE-M",
        color: "Trắng",
        colorCode: "#FFFFFF",
        size: "M",
        price: 199000,
        stockQuantity: 25
      },
      {
        id: "var-002",
        sku: "AT-001-BLACK-L",
        color: "Đen",
        colorCode: "#000000",
        size: "L",
        price: 199000,
        stockQuantity: 12
      }
    ],
    minPrice: 199000,
    maxPrice: 199000,
    originalPrice: 249000,
    ratingAverage: 4.8,
    reviewCount: 125,
    soldCount: 650,
    status: "ACTIVE",
    createdAt: "2026-11-01T08:00:00Z",
    updatedAt: "2026-11-01T08:00:00Z"
  }
];
```

Yêu cầu tạo:

- Ít nhất 30–50 sản phẩm thời trang mẫu.
- Nhiều nhóm danh mục khác nhau.
- Mỗi sản phẩm có biến thể hợp lý.
- Ảnh sản phẩm phù hợp nội dung.
- Có sản phẩm hết hàng hoặc gần hết hàng.
- Có giá gốc và giá khuyến mãi.
- Có dữ liệu đơn hàng ở nhiều trạng thái.
- Có người dùng mẫu USER và ADMIN.
- Có dữ liệu chatbot và tài liệu tham khảo.
- Có dữ liệu thống kê dashboard.

Mock data cần có quan hệ nhất quán. Ví dụ categoryId của Product phải tồn tại trong danh sách Category.

Ảnh mẫu nên lưu trong public/mock/products hoặc sử dụng nguồn ảnh được phép dùng. Không sử dụng URL không đáng tin cậy làm ảnh sản phẩm chính.

# VIII. KIẾN TRÚC GỌI API — BẮT BUỘC

Frontend phải có hai chế độ:

**1. MOCK MODE:** Chạy bằng dữ liệu mẫu.

**2. API MODE:** Gọi API Spring Boot thông qua API Gateway.

Ví dụ .env:

```env
VITE_API_BASE_URL=http://localhost:8080/api/v1
VITE_ENABLE_MOCK=true
```

Thiết kế một lớp HTTP client tập trung để:

- Cấu hình baseURL.
- Gửi request.
- Xử lý HTTP status.
- Xử lý lỗi API.
- Gắn access token khi phù hợp.
- Xử lý lỗi 401/403.
- Quản lý timeout.
- Hỗ trợ AbortSignal và hủy request khi cần.

Dữ liệu nhận từ API phải được chuyển thành model phù hợp UI bằng adapter/mapper nếu cấu trúc Backend khác với model của Frontend.

**Không gọi Axios trực tiếp trong JSX hoặc page component.**

Tổ chức ví dụ:

```ts
export interface ProductRepository {
  getProducts(
    params: ProductQueryParams
  ): Promise<PageResponse<Product>>;

  getBySlug(slug: string): Promise<Product>;

  getById(id: string): Promise<Product>;
}
```

Có hai implementation:

```ts
MockProductRepository
HttpProductRepository
```

Hoặc dùng MSW để mock HTTP tại ranh giới network, nếu phương án này giúp tránh viết adapter trùng lặp.

Chọn một kiến trúc nhất quán, không tạo đồng thời nhiều lớp abstraction không cần thiết.

Các React hook như `useProducts`, `useProductDetail`, `useOrders`, `useChat` chỉ sử dụng repository/service, không cần biết dữ liệu lấy từ mock hay HTTP.

Ví dụ:

```ts
export function useProducts(params: ProductQueryParams) {
  return useQuery({
    queryKey: ["products", params],
    queryFn: () => productRepository.getProducts(params)
  });
}
```

Mọi chức năng cần có API service rõ ràng:

- authApi
- productApi
- categoryApi
- cartApi
- orderApi
- userApi
- adminApi
- chatApi
- knowledgeApi

# IX. HỢP ĐỒNG API DỰ KIẾN VỚI SPRING BOOT

Sử dụng các endpoint dưới đây làm bản thiết kế sơ bộ và tập trung trong file cấu hình để có thể thay đổi dễ dàng.

## Auth Service

- POST /auth/register
- POST /auth/login
- POST /auth/logout
- POST /auth/refresh
- GET /users/me
- PUT /users/me

## Catalog Service

- GET /products
- GET /products/{id}
- GET /products/slug/{slug}
- GET /categories
- GET /categories/{id}
- GET /products/search
- GET /products/{id}/variants

## Order Service

- GET /cart
- POST /cart/items
- PATCH /cart/items/{id}
- DELETE /cart/items/{id}
- POST /orders
- GET /orders/my
- GET /orders/{id}
- PATCH /orders/{id}/cancel

## AI/RAG Service

- POST /chat
- GET /chat/conversations
- GET /chat/conversations/{id}
- GET /admin/knowledge
- POST /admin/knowledge
- DELETE /admin/knowledge/{id}

## Admin API

- GET /admin/products
- POST /admin/products
- PUT /admin/products/{id}
- DELETE /admin/products/{id}
- GET /admin/orders
- PATCH /admin/orders/{id}/status
- GET /admin/users
- GET /admin/statistics

Các endpoint chỉ là đề xuất ban đầu. API Gateway và Backend có thể sử dụng đường dẫn khác.

Hãy tập trung quản lý chúng tại một vị trí, không hardcode URL phân tán trong nhiều component.

# X. TƯƠNG THÍCH VỚI KAFKA, KUBERNETES VÀ MICROSERVICES

Backend của hệ thống sử dụng Spring Boot, Kafka và Kubernetes.

Frontend không được kết nối trực tiếp với Kafka Broker.

Frontend chỉ giao tiếp với API Gateway qua HTTP/HTTPS.

Các service Backend tự trao đổi sự kiện qua Kafka.

Ví dụ:

1. Khách hàng đặt đơn hàng trên giao diện.
2. Frontend gọi POST /orders.
3. Backend tiếp nhận yêu cầu.
4. Các service xử lý nghiệp vụ và trao đổi sự kiện nếu cần.
5. Frontend nhận trạng thái đơn hàng từ API.
6. Khi trạng thái thay đổi, giao diện cập nhật theo dữ liệu Backend.

Thiết kế giao diện chịu được eventual consistency:

- Hiển thị trạng thái PENDING, PROCESSING và CONFIRMED rõ ràng.
- Không mặc định đặt hàng thành công nghĩa là mọi bước xử lý đã hoàn tất.
- Có thể refetch theo khoảng thời gian hợp lý khi đơn đang xử lý.
- Có thể bổ sung Server-Sent Events hoặc WebSocket sau này nếu Backend hỗ trợ.
- Không tự cập nhật trạng thái đơn hàng thành công nếu chưa có xác nhận thực tế.

Kubernetes không yêu cầu logic giao diện đặc biệt. Frontend phải sử dụng URL API cấu hình theo môi trường, tránh hardcode địa chỉ Pod, IP hoặc port nội bộ.

# XI. QUẢN LÝ AUTHENTICATION VÀ PHÂN QUYỀN

Cần xây dựng:

- AuthContext hoặc Auth Store.
- ProtectedRoute.
- AdminRoute.
- Trang đăng nhập.
- Trang đăng ký.
- Logout.
- Kiểm tra phiên đăng nhập.
- Hiển thị menu theo role.
- Xử lý hết hạn phiên.

Phải phân biệt Mock Auth và Real Auth.

Trong Mock Mode, tài khoản demo chỉ phục vụ giao diện và kiểm thử.

Không đưa mật khẩu thật, API secret, private key vào source code frontend.

Trong API Mode, sử dụng cơ chế access token/refresh token theo hợp đồng Backend; ưu tiên HttpOnly cookie cho refresh token nếu Backend hỗ trợ.

Frontend chỉ điều khiển điều hướng và giao diện. Backend luôn phải kiểm tra quyền truy cập thực tế.

# XII. QUẢN LÝ FORM VÀ VALIDATION

Tất cả form cần:

- Schema Zod.
- Validation rõ ràng.
- Error message dưới trường nhập.
- Disable submit khi đang gửi.
- Thông báo kết quả.
- Xử lý lỗi từ server.
- Giá trị mặc định hợp lý.
- Không tự động gửi lại yêu cầu tạo đơn hàng khi không chắc Backend đã xử lý hay chưa.

Các form quan trọng:

- Đăng nhập.
- Đăng ký.
- Chỉnh sửa tài khoản.
- Thêm địa chỉ.
- Checkout.
- Thêm/sửa sản phẩm.
- Tạo danh mục.
- Cập nhật tồn kho.
- Quản lý tài liệu AI.

# XIII. YÊU CẦU CHẤT LƯỢNG CODE

Bắt buộc tuân thủ:

1. Sử dụng TypeScript strict mode.
2. Ưu tiên named exports nhất quán, trừ nơi framework cần default export.
3. Không sử dụng any tùy tiện.
4. Không lặp lại cấu trúc UI nhiều lần.
5. Mỗi component chỉ có một trách nhiệm chính.
6. Tách business logic khỏi JSX.
7. Tách constants và utilities.
8. Không sử dụng useEffect để gọi API thủ công khi đã có TanStack Query.
9. Không lưu server data trùng lặp giữa nhiều store.
10. Không sử dụng index làm key cho danh sách có định danh ổn định.
11. Không thao tác DOM trực tiếp nếu React có thể quản lý.
12. Không để console.log debug trong code hoàn thiện.
13. Không tạo abstraction phức tạp chỉ để trông chuyên nghiệp.
14. Không dùng CSS inline tràn lan.
15. Không để TypeScript hoặc ESLint errors.
16. Không sử dụng các đoạn comment mô tả hiển nhiên.
17. Chỉ thêm comment khi giải thích quyết định kỹ thuật hoặc logic khó hiểu.
18. Tạo utility formatCurrency, formatDate, formatOrderStatus.
19. Tạo component dùng chung cho loading/error/empty state.
20. Tách component hiển thị và logic truy xuất dữ liệu khi thực sự cần thiết.

Cần viết code theo cách một lập trình viên có kinh nghiệm có thể đọc, hiểu và tiếp tục phát triển.

# XIV. KIỂM THỬ

Tạo tối thiểu một số bài test cho:

- Format tiền tệ.
- Validation form.
- ProductCard.
- ProductFilter.
- Cart calculations.
- Thêm/xóa sản phẩm giỏ hàng.
- Chọn biến thể sản phẩm.
- ProtectedRoute.
- Mapping dữ liệu API.
- Luồng đặt hàng trong mock mode.

Có thể dùng Vitest, React Testing Library và MSW.

Phân biệt rõ unit test, component test và integration test.

# XV. README VÀ TÀI LIỆU API

Tạo README.md gồm:

1. Giới thiệu dự án.
2. Công nghệ sử dụng.
3. Cấu trúc thư mục.
4. Cách cài đặt.
5. Cách chạy Mock Mode.
6. Cách chạy API Mode.
7. Danh sách trang.
8. Danh sách API và service tương ứng.
9. Cấu trúc dữ liệu chính.
10. Cách bổ sung một trang mới.
11. Cách bổ sung một API mới.
12. Cách thay dữ liệu mẫu bằng Backend thật.
13. Hướng dẫn build production.
14. Tài khoản demo trong Mock Mode.

Tạo thêm tài liệu API_CONTRACT.md gồm:

- Method.
- Endpoint.
- Request parameters.
- Request body.
- Response JSON.
- HTTP status code.
- Error response.
- Service phụ trách.
- Trang Frontend sử dụng API.
- Trạng thái: mock / chưa tích hợp / đã tích hợp Backend.

# XVI. THỨ TỰ TRIỂN KHAI

Không tạo ra một bản code khổng lồ thiếu kiểm soát.

Thực hiện theo thứ tự:

**Giai đoạn 1:** Khởi tạo React, TypeScript, routing, theme, layout, component cơ bản.

**Giai đoạn 2:** Xây dựng types, schemas, mock data, API repository và HTTP client.

**Giai đoạn 3:** Xây dựng trang chủ, danh mục, sản phẩm, tìm kiếm, chi tiết sản phẩm.

**Giai đoạn 4:** Xây dựng authentication, giỏ hàng, checkout, đơn hàng và tài khoản.

**Giai đoạn 5:** Xây dựng toàn bộ giao diện Admin.

**Giai đoạn 6:** Xây dựng chatbot và các trang quản lý AI/RAG.

**Giai đoạn 7:** Hoàn thiện responsive, form validation, loading, error và empty state.

**Giai đoạn 8:** Viết test, rà soát TypeScript, build và hoàn thiện tài liệu tích hợp API.

Trong mỗi giai đoạn:

- Tạo file thực tế.
- Kết nối các route và component.
- Đảm bảo code compile.
- Hoàn thiện tương tác.
- Kiểm tra và sửa lỗi.
- Không xóa các chức năng đã hoàn thành.
- Không tuyên bố hoàn thành khi chưa kiểm tra được.

# XVII. TIÊU CHÍ NGHIỆM THU

Frontend được coi là hoàn thành khi:

- Tất cả các trang trong phạm vi đã liệt kê đều tồn tại.
- Các trang có thiết kế thống nhất.
- Giao diện hoạt động responsive.
- Có dữ liệu mẫu đầy đủ.
- Không xuất hiện trang trắng hoặc lỗi runtime phổ biến.
- Có thể xem sản phẩm, lọc, tìm kiếm và xem chi tiết.
- Có thể chọn size, màu và thêm vào giỏ.
- Có thể tạo đơn hàng thử trong Mock Mode.
- Có thể xem lịch sử và trạng thái đơn hàng.
- Có thể đăng nhập bằng tài khoản demo.
- Có thể chuyển giữa USER và ADMIN theo quyền của mock.
- Các chức năng quản trị cốt lõi hoạt động bằng mock data có trạng thái thay đổi nhất quán.
- Chatbot có giao diện hội thoại và dữ liệu phản hồi mẫu.
- API được tổ chức để tích hợp Spring Boot mà không phải sửa từng trang.
- Có cấu hình môi trường.
- Có tài liệu API Contract.
- Có README.
- Không có lỗi TypeScript và build.
- Những tính năng mới chỉ có UI hoặc mock được ghi rõ, không mô tả là đã tích hợp Backend thật.

# XVIII. YÊU CẦU BẮT ĐẦU

Trước tiên, hãy khảo sát workspace/repository hiện tại nếu đã tồn tại, giữ lại phần code hợp lý và không ghi đè tùy tiện.

Sau đó:

1. Trình bày ngắn gọn kiến trúc Frontend sẽ sử dụng.
2. Liệt kê các nhóm page và component.
3. Xác định cấu trúc thư mục.
4. Chuẩn hóa data models và API contract.
5. Bắt đầu triển khai code thực tế theo đúng các giai đoạn.
6. Liên tục kiểm tra lỗi build và các chức năng.
7. Khi hoàn thành, báo cáo các page đã tạo, chức năng hoạt động, mock data và những API cần Backend cung cấp.

Không dừng ở việc mô tả kế hoạch. Hãy thực sự tạo source code hoàn chỉnh trong workspace được cung cấp.

Nếu môi trường không cho phép chạy lệnh hoặc chỉnh sửa file, hãy cung cấp cấu trúc dự án và mã nguồn theo từng file, không khẳng định đã build/test thành công.

**Ưu tiên cuối cùng: giao diện đẹp, thực tế, sạch sẽ, dễ bảo trì, dễ đấu nối API và không có cảm giác code được tạo vội bằng AI.**