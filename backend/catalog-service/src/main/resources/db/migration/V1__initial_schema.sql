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
