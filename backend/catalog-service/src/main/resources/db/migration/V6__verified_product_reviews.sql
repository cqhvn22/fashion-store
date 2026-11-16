CREATE TABLE product_reviews (
    id UUID PRIMARY KEY,
    order_id UUID NOT NULL,
    order_item_id UUID NOT NULL UNIQUE,
    user_id UUID NOT NULL,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    variant_id UUID NOT NULL,
    size VARCHAR(40) NOT NULL,
    color VARCHAR(80) NOT NULL,
    rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    content VARCHAR(2000) NOT NULL,
    status VARCHAR(8) NOT NULL DEFAULT 'VISIBLE' CHECK (status IN ('VISIBLE', 'HIDDEN')),
    edit_count SMALLINT NOT NULL DEFAULT 0 CHECK (edit_count BETWEEN 0 AND 1),
    seller_reply VARCHAR(1000),
    replied_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (length(trim(content)) BETWEEN 10 AND 2000)
);
CREATE INDEX ix_product_reviews_product_time
    ON product_reviews (product_id, created_at DESC) WHERE status='VISIBLE';
CREATE INDEX ix_product_reviews_user_order
    ON product_reviews (user_id, order_id);

CREATE TABLE review_images (
    id UUID PRIMARY KEY,
    review_id UUID NOT NULL REFERENCES product_reviews(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    sort_order SMALLINT NOT NULL DEFAULT 0
);
CREATE INDEX ix_review_images_review ON review_images (review_id, sort_order);

-- Các số liệu cũ chỉ là dữ liệu trình diễn; từ đây chỉ tính từ đánh giá đã xác thực.
UPDATE products SET rating_average=0, review_count=0
WHERE rating_average<>0 OR review_count<>0;
