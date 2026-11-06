# Biểu đồ use case tổng quan - FashionHub

Biểu đồ thể hiện các chức năng chính của **toàn hệ thống** và ba vai trò sử dụng. Các chức năng cụ thể sẽ được phân rã trong sơ đồ chi tiết ở giai đoạn sau. [Bản UML PlantUML](use-case-overview.puml) là nguồn có thể chỉnh sửa.

~~~mermaid
flowchart LR
  G["👤 Khách truy cập"]
  C["👤 Khách hàng"]
  A["👤 Quản trị viên"]

  subgraph SYSTEM["Hệ thống FashionHub"]
    browse(["Khám phá sản phẩm"])
    search(["Tìm kiếm và lọc sản phẩm"])
    cart(["Quản lý giỏ hàng"])
    wishlist(["Lưu sản phẩm yêu thích"])
    info(["Xem thông tin và chính sách"])
    auth(["Đăng ký / đăng nhập"])
    chat(["Nhận tư vấn mua sắm"])
    account(["Quản lý tài khoản"])
    checkout(["Đặt hàng COD"])
    myorders(["Theo dõi và hủy đơn"])
    catalog(["Quản lý sản phẩm và danh mục"])
    stock(["Quản lý tồn kho"])
    orders(["Quản lý đơn hàng"])
    knowledge(["Quản lý tri thức AI"])
    reports(["Xem báo cáo và người dùng"])
  end

  G --> browse
  G --> search
  G --> cart
  G --> wishlist
  G --> info
  G --> auth
  G --> chat
  C --> account
  C --> checkout
  C --> myorders
  A --> catalog
  A --> stock
  A --> orders
  A --> knowledge
  A --> reports
~~~

**Vai trò:** Khách hàng có các quyền của khách truy cập; quản trị viên có các quyền của khách hàng và quyền quản trị. Phạm vi này dựa trên các route và màn hình hiện có trong frontend.

**Trạng thái triển khai:** Frontend đang chạy bằng dữ liệu demo. Backend nghiệp vụ và AI/RAG thực chưa được tích hợp; sơ đồ mô tả chức năng hệ thống hướng tới theo giao diện hiện có, không khẳng định các API đã hoàn thành.
