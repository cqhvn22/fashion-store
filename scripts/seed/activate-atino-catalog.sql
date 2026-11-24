-- Chạy bằng psql cùng thư mục với atino-catalog.sql.
-- Giữ sản phẩm cũ để đơn hàng/đánh giá đã tạo vẫn có thể tra cứu.
\set ON_ERROR_STOP on

BEGIN;
INSERT INTO categories (id, name, slug, description, is_active)
VALUES
  (md5('fashion-category:ao-nam')::uuid, 'Áo nam', 'ao-nam', 'Áo nam ATINO', true),
  (md5('fashion-category:quan')::uuid, 'Quần', 'quan', 'Quần nam ATINO', true),
  (md5('fashion-category:ao-khoac')::uuid, 'Áo khoác', 'ao-khoac', 'Áo khoác ATINO', true),
  (md5('fashion-category:phu-kien')::uuid, 'Phụ kiện', 'phu-kien', 'Phụ kiện ATINO', true)
ON CONFLICT (slug) DO UPDATE SET is_active = true;
COMMIT;

\ir atino-catalog.sql

BEGIN;
-- Chỉ ẩn sản phẩm mẫu khỏi cửa hàng; không xóa dữ liệu đang được đơn hàng tham chiếu.
UPDATE products SET status = 'INACTIVE', updated_at = now()
WHERE brand IS DISTINCT FROM 'ATINO' AND status = 'ACTIVE';
UPDATE categories SET is_active = false, updated_at = now()
WHERE slug LIKE 'demo-%' OR slug LIKE 'test-%';

-- Số sao/lượt đánh giá giả trong file crawl không phải đánh giá khách mua đã xác thực.
UPDATE products p SET rating_average = 0, review_count = 0
WHERE p.brand = 'ATINO' AND NOT EXISTS (
  SELECT 1 FROM product_reviews r WHERE r.product_id = p.id AND r.status = 'VISIBLE'
);

UPDATE categories root SET image_url = (
  SELECT pi.url
  FROM categories child
  JOIN products p ON p.category_id = child.id AND p.brand = 'ATINO' AND p.status = 'ACTIVE'
  JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary
  WHERE child.parent_id = root.id
  ORDER BY p.sold_count DESC, p.name
  LIMIT 1
), updated_at = now()
WHERE root.slug IN ('ao-nam', 'quan', 'ao-khoac', 'phu-kien');

UPDATE home_banners SET
  title = 'ATINO — phong cách mỗi ngày',
  subtitle = 'Khám phá áo nam, quần và phụ kiện trong bộ sưu tập ATINO.',
  image_url = COALESCE((
    SELECT pi.url FROM products p
    JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary
    WHERE p.brand = 'ATINO' AND p.slug LIKE 'ao-jacket%'
    ORDER BY p.sold_count DESC LIMIT 1
  ), '/images/products/ao-ni-basic-vai-xop-loose-l.3.7795-p37939753_1.png'),
  link_url = '/categories/ao-nam', button_label = 'Khám phá ngay',
  is_active = true, updated_at = now()
WHERE id = 'a1111111-1111-4111-8111-111111111111';

UPDATE home_banners SET
  title = 'Bộ sưu tập ATINO mới',
  subtitle = 'Chọn trang phục thoải mái, phù hợp phong cách của bạn.',
  image_url = COALESCE((
    SELECT pi.url FROM products p
    JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary
    WHERE p.brand = 'ATINO' AND p.slug LIKE 'ao-phong%'
    ORDER BY p.sold_count DESC LIMIT 1
  ), '/images/products/ao-phong-loose-l.3.2755-p37937106_1.jpg'),
  link_url = '/products', button_label = 'Xem sản phẩm',
  is_active = true, updated_at = now()
WHERE id = 'a2222222-2222-4222-8222-222222222222';
COMMIT;

SELECT 'active_atino_products' AS metric, count(*) AS total
FROM products WHERE brand = 'ATINO' AND status = 'ACTIVE'
UNION ALL
SELECT 'active_legacy_products', count(*)
FROM products WHERE brand IS DISTINCT FROM 'ATINO' AND status = 'ACTIVE';
