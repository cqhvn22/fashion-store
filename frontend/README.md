# FashionHub Frontend

Xem [FRONTEND_STRUCTURE.md](FRONTEND_STRUCTURE.md) để nắm nhanh cấu trúc mã nguồn.

React SPA cho đồ án **website bán thời trang theo kiến trúc Microservices tích hợp AI/RAG**. Ứng dụng chạy độc lập bằng dữ liệu mẫu; các service tập trung API để chuyển sang Quarkus API Gateway.

## Công nghệ

React 19, TypeScript strict, Vite, React Router, Tailwind CSS, TanStack Query, Axios, React Hook Form, Zod, Zustand, Lucide, Recharts, Vitest, ESLint và Prettier.

## Chạy dự án

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Mở `http://localhost:5173`. Mặc định `VITE_ENABLE_MOCK=true`; dữ liệu thao tác được lưu trong `localStorage` của trình duyệt. Để xóa demo, xóa site data trong trình duyệt. Build: `pnpm build`. Kiểm tra: `pnpm lint` và `pnpm test`.

## Tài khoản demo

| Vai trò    | Email                 | Mật khẩu   |
| ---------- | --------------------- | ---------- |
| Khách hàng | `user@fashionhub.vn`  | `Demo@123` |
| Quản trị   | `admin@fashionhub.vn` | `Demo@123` |

Tài khoản mới đăng ký trong mock mode được lưu cục bộ trong trình duyệt. Đây chỉ là cơ chế demo, không phải hệ thống xác thực production.

## Cấu trúc

- `src/types`: hợp đồng dữ liệu chuẩn cho giao diện.
- `src/mocks`: 36 sản phẩm, 6 danh mục, người dùng, đơn hàng, tài liệu AI.
- `src/services`: HTTP client, endpoint và các service catalog, đơn hàng, AI.
- `src/stores`: session, giỏ hàng, yêu thích ở client.
- `src/features`: trang theo nhóm chức năng.
- `src/components`: layout và component dùng chung.
- `src/tests`: kiểm thử dữ liệu, giỏ hàng và luồng đặt hàng mock.

## Trang và luồng demo

Khách hàng: trang chủ, danh mục, danh sách sản phẩm, tìm kiếm, chi tiết sản phẩm, giỏ hàng, checkout COD, kết quả đặt hàng, đăng nhập/đăng ký, hồ sơ, địa chỉ, lịch sử và chi tiết đơn, yêu thích, chatbot, trang thông tin và trang lỗi.

Admin: tổng quan, sản phẩm (tạo/sửa/xóa), danh mục (tạo/sửa/xóa khi không còn sản phẩm), tồn kho, đơn hàng (chuyển trạng thái hợp lệ), kho tri thức và hội thoại AI, báo cáo cơ bản, danh sách người dùng mẫu. Ảnh sản phẩm đang dùng URL cố định của Unsplash; khi triển khai chính thức nên chuyển sang asset/CDN của cửa hàng.

## Chế độ API

Đặt `VITE_ENABLE_MOCK=false` và `VITE_API_BASE_URL` trỏ tới API Gateway. `src/services/endpoints.ts` là nơi sửa đường dẫn; `src/services/httpClient.ts` xử lý token, timeout và lỗi HTTP. Các response dự kiến có dạng `{ success, data, message }`. Xem [API_CONTRACT.md](API_CONTRACT.md) để đối chiếu Backend.

Các API chỉ là hợp đồng đề xuất, **chưa được thử với Backend thực**. Giỏ hàng, yêu thích và địa chỉ hiện lưu cục bộ; nếu Backend có API tương ứng, bổ sung service adapter rồi thay lời gọi trong feature. Quản lý danh mục, tồn kho, hội thoại AI và người dùng trong API mode hiện thông báo chưa tích hợp. Mock chatbot dùng quy tắc đơn giản và nguồn tài liệu mẫu, không phải mô hình AI thực. Chức năng gửi email quên mật khẩu và đổi mật khẩu chưa tích hợp.

## Bổ sung tính năng

Tạo model trong `src/types/models.ts`, thêm endpoint ở `src/services/endpoints.ts`, triển khai service trả về model chuẩn, sau đó tạo trang/hook trong `src/features` và nối route ở `src/app/App.tsx`. Với dữ liệu nhiều trang, sử dụng TanStack Query; với state cục bộ, dùng Zustand. Khi Backend trả schema khác, chuyển đổi tại service trước khi đưa vào UI.
