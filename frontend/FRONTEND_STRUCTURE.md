# Cấu trúc Frontend

FashionHub là React SPA viết bằng TypeScript và Vite. `src/main.tsx` khởi tạo ứng dụng; `src/app/App.tsx` khai báo route và bảo vệ trang cần đăng nhập hoặc quyền Admin.

| Thư mục           | Vai trò                                                                                        |
| ----------------- | ---------------------------------------------------------------------------------------------- |
| `src/features/`   | Trang và logic giao diện theo nhóm: sản phẩm, xác thực, thanh toán, tài khoản, admin, chatbot. |
| `src/components/` | Header, footer và các thành phần giao diện dùng lại.                                           |
| `src/services/`   | Lấy và cập nhật dữ liệu; chọn mock hoặc API Gateway tại đây.                                   |
| `src/mocks/`      | Dữ liệu demo ban đầu.                                                                          |
| `src/stores/`     | Trạng thái trên trình duyệt như tài khoản, giỏ hàng, yêu thích.                                |
| `src/types/`      | Kiểu dữ liệu chung cho sản phẩm, đơn hàng, người dùng và chat.                                 |
| `src/utils/`      | Hàm định dạng tiền, ngày và trạng thái.                                                        |
| `src/tests/`      | Kiểm thử các luồng dữ liệu chính.                                                              |

Luồng dữ liệu: **Trang → service → dữ liệu mock hoặc API Gateway**. Danh sách và chi tiết được TanStack Query lưu cache; trạng thái cần dùng chung trên trình duyệt được Zustand quản lý. Giao diện dùng Tailwind CSS trong `src/styles.css`.
