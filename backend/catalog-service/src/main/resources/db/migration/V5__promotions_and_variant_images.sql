CREATE TABLE product_promotions (
    id UUID PRIMARY KEY,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    discount_type VARCHAR(10) NOT NULL CHECK (discount_type IN ('PERCENT', 'FIXED')),
    discount_value BIGINT NOT NULL CHECK (discount_value > 0),
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (starts_at < ends_at),
    CHECK (discount_type <> 'PERCENT' OR discount_value BETWEEN 1 AND 99)
);
CREATE INDEX ix_product_promotions_schedule
    ON product_promotions (product_id, starts_at, ends_at) WHERE is_enabled;

CREATE TABLE variant_images (
    id UUID PRIMARY KEY,
    variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    alt VARCHAR(250) NOT NULL DEFAULT '',
    is_primary BOOLEAN NOT NULL DEFAULT false,
    sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX ix_variant_images_variant ON variant_images (variant_id, sort_order);
CREATE UNIQUE INDEX ux_variant_images_primary ON variant_images (variant_id) WHERE is_primary;

INSERT INTO variant_images (id, variant_id, url, alt, is_primary, sort_order)
SELECT gen_random_uuid(), id, image_url, '', true, 0
FROM product_variants WHERE image_url IS NOT NULL AND image_url <> '';

-- Giá bán được tính từ giá niêm yết của biến thể và chương trình đang có hiệu lực.
-- Khoảng thời gian [bắt đầu, kết thúc); giá trong giỏ chỉ mang tính tham khảo.
CREATE VIEW current_variant_prices AS
SELECT v.id AS variant_id,
       v.price AS regular_price,
       CASE WHEN promotion.id IS NULL THEN v.price
            WHEN promotion.discount_type = 'PERCENT' THEN
                greatest(1000::bigint, floor(v.price * (100 - promotion.discount_value)::numeric / 100)::bigint)
            ELSE greatest(1000::bigint, v.price - promotion.discount_value)
       END AS effective_price,
       promotion.id AS promotion_id
FROM product_variants v
LEFT JOIN LATERAL (
    SELECT id, discount_type, discount_value
    FROM product_promotions p
    WHERE p.product_id = v.product_id AND p.is_enabled
      AND p.starts_at <= now() AND p.ends_at > now()
    ORDER BY p.starts_at DESC, p.created_at DESC
    LIMIT 1
) promotion ON true;

-- Chuyển giá so sánh của dữ liệu demo thành chương trình thật, giữ nguyên giá
-- khách đang thấy trong 30 ngày đầu. Dữ liệu sản phẩm khác không bị sửa giá.
INSERT INTO product_promotions
    (id, product_id, name, discount_type, discount_value, starts_at, ends_at, is_enabled)
SELECT md5('fashion-demo:promotion:' || p.slug)::uuid, p.id, 'Ưu đãi FashionHub',
       'FIXED', p.original_price - min(v.price), now() - interval '1 day',
       now() + interval '30 days', true
FROM products p JOIN product_variants v ON v.product_id=p.id
WHERE p.brand='FashionHub Demo' AND p.slug LIKE 'demo-%' AND p.original_price IS NOT NULL
GROUP BY p.id, p.slug, p.original_price
HAVING p.original_price > min(v.price) AND p.original_price - min(v.price) < p.original_price - 1000;

UPDATE product_variants v SET price=p.original_price
FROM products p JOIN product_promotions promotion ON promotion.product_id=p.id
WHERE v.product_id=p.id AND p.brand='FashionHub Demo' AND p.slug LIKE 'demo-%';
