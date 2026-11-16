\set ON_ERROR_STOP on
BEGIN;

-- UUID cố định theo slug/SKU: chạy lại không nhân đôi hoặc ghi đè thay đổi của admin.
INSERT INTO categories (id, name, slug, description, is_active)
SELECT md5('fashion-demo:category:' || slug)::uuid, name, slug, description, active
FROM (VALUES
    ('Áo nữ', 'demo-ao-nu', 'Áo nữ theo phong cách thường ngày.', true),
    ('Áo nam', 'demo-ao-nam', 'Áo nam cơ bản và dễ phối.', true),
    ('Quần', 'demo-quan', 'Quần jean, quần tây và các kiểu dáng khác.', true),
    ('Phụ kiện', 'demo-phu-kien', 'Phụ kiện hoàn thiện trang phục.', true),
    ('Bộ sưu tập ẩn', 'demo-bo-suu-tap-an', 'Dùng thử nhánh danh mục bị ẩn.', false)
) AS seed(name, slug, description, active)
ON CONFLICT DO NOTHING;

INSERT INTO categories (id, parent_id, name, slug, description, is_active)
SELECT md5('fashion-demo:category:' || seed.slug)::uuid,
       parent.id, seed.name, seed.slug, seed.description, true
FROM (VALUES
    ('demo-ao-nu', 'Áo thun nữ', 'demo-ao-thun-nu', 'Áo thun nữ mềm mại.'),
    ('demo-ao-nu', 'Áo khoác nữ', 'demo-ao-khoac-nu', 'Áo khoác nữ cho nhiều mùa.'),
    ('demo-ao-nam', 'Áo thun nam', 'demo-ao-thun-nam', 'Áo thun nam cơ bản.'),
    ('demo-ao-nam', 'Áo khoác nam', 'demo-ao-khoac-nam', 'Áo khoác nam năng động.'),
    ('demo-quan', 'Quần jean', 'demo-quan-jean', 'Quần jean dễ phối.'),
    ('demo-quan', 'Quần tây', 'demo-quan-tay', 'Quần tây thanh lịch.'),
    ('demo-phu-kien', 'Túi xách', 'demo-tui-xach', 'Túi đi làm và đi chơi.'),
    ('demo-phu-kien', 'Mũ', 'demo-mu', 'Mũ cho ngày nắng.'),
    ('demo-bo-suu-tap-an', 'Hàng thử ẩn', 'demo-hang-thu-an', 'Kiểm tra ẩn cả nhánh.')
) AS seed(parent_slug, name, slug, description)
JOIN categories parent ON parent.slug = seed.parent_slug
ON CONFLICT DO NOTHING;

INSERT INTO categories (id, parent_id, name, slug, description, is_active)
SELECT md5('fashion-demo:category:' || seed.slug)::uuid,
       parent.id, seed.name, seed.slug, seed.description, true
FROM (VALUES
    ('demo-ao-khoac-nu', 'Áo phao nữ', 'demo-ao-phao-nu', 'Áo phao nhẹ cho ngày lạnh.'),
    ('demo-ao-khoac-nu', 'Cardigan nữ', 'demo-cardigan-nu', 'Cardigan dệt kim.'),
    ('demo-ao-khoac-nam', 'Áo bomber nam', 'demo-bomber-nam', 'Bomber dáng gọn.')
) AS seed(parent_slug, name, slug, description)
JOIN categories parent ON parent.slug = seed.parent_slug
ON CONFLICT DO NOTHING;

-- 13 sản phẩm: 12 sản phẩm công khai, 1 sản phẩm nằm trong nhánh ẩn.
INSERT INTO products (id, category_id, slug, name, description, brand, status, original_price)
SELECT md5('fashion-demo:product:' || seed.slug)::uuid,
       category.id, seed.slug, seed.name, seed.description,
       'FashionHub Demo', 'ACTIVE', seed.original_price
FROM (VALUES
    ('demo-ao-thun-nu', 'demo-ao-thun-nu-cotton', 'Áo thun nữ cotton mềm', 'Cotton thoáng mát, mặc hằng ngày.', 249000::bigint),
    ('demo-ao-thun-nu', 'demo-ao-thun-nu-ribbed', 'Áo thun nữ ribbed', 'Chất vải co giãn nhẹ.', 279000::bigint),
    ('demo-ao-phao-nu', 'demo-ao-phao-nu-nhe', 'Áo phao nữ dáng nhẹ', 'Thiết kế giữ ấm và gọn dáng.', 899000::bigint),
    ('demo-cardigan-nu', 'demo-cardigan-nu-kem', 'Cardigan nữ màu kem', 'Dệt kim mềm, dễ phối lớp.', 629000::bigint),
    ('demo-ao-thun-nam', 'demo-ao-thun-nam-basic', 'Áo thun nam basic', 'Phom thoải mái cho mọi ngày.', 269000::bigint),
    ('demo-ao-thun-nam', 'demo-polo-nam-toi-gian', 'Polo nam tối giản', 'Cổ bẻ, chất liệu thoáng.', 379000::bigint),
    ('demo-bomber-nam', 'demo-bomber-nam-den', 'Áo bomber nam đen', 'Dáng bomber gọn và dễ mặc.', 829000::bigint),
    ('demo-quan-jean', 'demo-jean-ong-suong', 'Quần jean ống suông', 'Denim xanh cổ điển.', 579000::bigint),
    ('demo-quan-jean', 'demo-jean-ong-dung', 'Quần jean ống đứng', 'Đường cắt gọn gàng.', 559000::bigint),
    ('demo-quan-tay', 'demo-quan-tay-den', 'Quần tây đen', 'Phù hợp đi làm và dự tiệc.', 529000::bigint),
    ('demo-tui-xach', 'demo-tui-tote-vai', 'Túi tote vải', 'Túi rộng cho đồ dùng hằng ngày.', 329000::bigint),
    ('demo-mu', 'demo-mu-bucket', 'Mũ bucket canvas', 'Canvas nhẹ, vành mềm.', 259000::bigint),
    ('demo-hang-thu-an', 'demo-san-pham-an', 'Sản phẩm thuộc nhánh ẩn', 'Chỉ xuất hiện trong quản trị.', 199000::bigint)
) AS seed(category_slug, slug, name, description, original_price)
JOIN categories category ON category.slug = seed.category_slug
ON CONFLICT DO NOTHING;

-- Ảnh mẫu sử dụng URL cố định, cùng nguồn với dữ liệu mock hiện có.
INSERT INTO product_images (id, product_id, url, alt, is_primary, sort_order)
SELECT md5('fashion-demo:image:' || seed.slug)::uuid,
       product.id,
       'https://images.unsplash.com/' || seed.photo || '?auto=format&fit=crop&w=900&q=80',
       product.name, true, 0
FROM (VALUES
    ('demo-ao-thun-nu-cotton', 'photo-1503342217505-b0a15ec3261c'),
    ('demo-ao-thun-nu-ribbed', 'photo-1529139574466-a303027c1d8b'),
    ('demo-ao-phao-nu-nhe', 'photo-1544923246-77307dd654cb'),
    ('demo-cardigan-nu-kem', 'photo-1434389677669-e08b4cac3105'),
    ('demo-ao-thun-nam-basic', 'photo-1521572163474-6864f9cf17ab'),
    ('demo-polo-nam-toi-gian', 'photo-1620012253295-c15cc3e65df4'),
    ('demo-bomber-nam-den', 'photo-1551028719-00167b16eac5'),
    ('demo-jean-ong-suong', 'photo-1542272604-787c3835535d'),
    ('demo-jean-ong-dung', 'photo-1541099649105-f69ad21f3246'),
    ('demo-quan-tay-den', 'photo-1594633312681-425c7b97ccd1'),
    ('demo-tui-tote-vai', 'photo-1590874103328-eac38a683ce7'),
    ('demo-mu-bucket', 'photo-1521369909029-2afed882baee'),
    ('demo-san-pham-an', 'photo-1554568218-0f1715e72254')
) AS seed(slug, photo)
JOIN products product ON product.slug = seed.slug
    AND product.id = md5('fashion-demo:product:' || seed.slug)::uuid
ON CONFLICT DO NOTHING;

-- Quần áo: 2 màu x 3 size; phụ kiện: 2 màu x một size.
INSERT INTO product_variants
    (id, product_id, sku, color, color_code, size, price, stock_quantity, image_url, is_active)
SELECT md5('fashion-demo:variant:' || sku.value)::uuid,
       product.id, sku.value, color.name, color.code, size.value,
       product.original_price - 30000,
       CASE WHEN product.slug = 'demo-ao-phao-nu-nhe' AND color.name = 'Đen' AND size.value = 'M'
            THEN 0 ELSE 8 END,
       image.url, true
FROM products product
JOIN product_images image ON image.product_id = product.id AND image.is_primary
CROSS JOIN (VALUES ('Kem', '#e6d8c3'), ('Đen', '#292929')) AS color(name, code)
CROSS JOIN LATERAL unnest(CASE WHEN product.slug IN ('demo-tui-tote-vai', 'demo-mu-bucket')
                               THEN ARRAY['Một cỡ'] ELSE ARRAY['S', 'M', 'L'] END) AS size(value)
CROSS JOIN LATERAL (SELECT upper(replace(product.slug, '-', '_')) || '-' ||
                           CASE WHEN color.name = 'Kem' THEN 'KEM' ELSE 'DEN' END || '-' ||
                           CASE WHEN size.value = 'Một cỡ' THEN 'OS' ELSE size.value END AS value) sku
WHERE product.id = md5('fashion-demo:product:' || product.slug)::uuid
  AND product.slug LIKE 'demo-%'
ON CONFLICT DO NOTHING;

COMMIT;

SELECT 'categories' AS kind, count(*) FROM categories WHERE slug LIKE 'demo-%'
UNION ALL SELECT 'products', count(*) FROM products WHERE slug LIKE 'demo-%'
UNION ALL SELECT 'variants', count(*) FROM product_variants WHERE sku LIKE 'DEMO_%';
