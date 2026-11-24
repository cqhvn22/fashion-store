CREATE TABLE carts (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE cart_items (
    id UUID PRIMARY KEY,
    cart_id UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
    product_id UUID NOT NULL,
    variant_id UUID NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    selected BOOLEAN NOT NULL DEFAULT true,
    added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (cart_id, variant_id)
);
CREATE INDEX ix_cart_items_cart ON cart_items (cart_id);

CREATE TABLE orders (
    id UUID PRIMARY KEY,
    order_code VARCHAR(40) NOT NULL UNIQUE,
    user_id UUID NOT NULL,
    checkout_id UUID NOT NULL UNIQUE,
    idempotency_key VARCHAR(120) NOT NULL,
    status VARCHAR(12) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN (
            'PENDING', 'CONFIRMED', 'PROCESSING',
            'SHIPPING', 'DELIVERED', 'CANCELLED'
        )),
    payment_method VARCHAR(20) NOT NULL DEFAULT 'COD'
        CHECK (payment_method IN ('COD', 'PAYOS')),
    payment_status VARCHAR(12) NOT NULL
        CHECK (payment_status IN (
            'UNPAID', 'PENDING', 'PAID', 'FAILED', 'CANCELLED', 'EXPIRED'
        )),
    shipping_address JSONB NOT NULL
        CHECK (jsonb_typeof(shipping_address) = 'object'),
    subtotal BIGINT NOT NULL CHECK (subtotal >= 0),
    shipping_fee BIGINT NOT NULL CHECK (shipping_fee >= 0),
    discount_amount BIGINT NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
    total_amount BIGINT NOT NULL CHECK (total_amount >= 0),
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, idempotency_key),
    CHECK (total_amount = subtotal + shipping_fee - discount_amount),
    CHECK (
        (payment_method = 'COD' AND payment_status IN ('UNPAID', 'PAID', 'CANCELLED'))
        OR (payment_method = 'PAYOS' AND payment_status <> 'UNPAID')
    )
);
CREATE INDEX ix_orders_user_time ON orders (user_id, created_at DESC);
CREATE INDEX ix_orders_status_time ON orders (status, created_at DESC);
CREATE INDEX ix_orders_payment_status_time ON orders (payment_status, created_at DESC);

CREATE TABLE order_items (
    id UUID PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL,
    variant_id UUID NOT NULL,
    product_name VARCHAR(250) NOT NULL,
    sku VARCHAR(80) NOT NULL,
    image_url TEXT,
    size VARCHAR(40) NOT NULL,
    color VARCHAR(80) NOT NULL,
    unit_price BIGINT NOT NULL CHECK (unit_price >= 0),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    line_total BIGINT NOT NULL CHECK (line_total >= 0),
    CHECK (line_total = unit_price * quantity)
);
CREATE INDEX ix_order_items_order ON order_items (order_id);

CREATE TABLE payment_attempts (
    id UUID PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES orders(id),
    provider VARCHAR(12) NOT NULL DEFAULT 'PAYOS' CHECK (provider = 'PAYOS'),
    provider_order_code BIGINT NOT NULL UNIQUE CHECK (provider_order_code > 0),
    payment_link_id VARCHAR(120) UNIQUE,
    checkout_url TEXT,
    amount BIGINT NOT NULL CHECK (amount > 0),
    status VARCHAR(12) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'PAID', 'FAILED', 'CANCELLED', 'EXPIRED')),
    expires_at TIMESTAMPTZ NOT NULL,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (status <> 'PAID' OR paid_at IS NOT NULL)
);
CREATE INDEX ix_payment_attempts_order_time
    ON payment_attempts (order_id, created_at DESC);
CREATE UNIQUE INDEX ux_payment_attempts_active_order
    ON payment_attempts (order_id) WHERE status = 'PENDING';

CREATE TABLE payment_webhook_events (
    id UUID PRIMARY KEY,
    payment_attempt_id UUID NOT NULL REFERENCES payment_attempts(id),
    payload_sha256 CHAR(64) NOT NULL UNIQUE,
    provider_reference VARCHAR(120),
    payload JSONB NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
    received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at TIMESTAMPTZ,
    processing_error TEXT
);
CREATE INDEX ix_payment_webhook_events_attempt_time
    ON payment_webhook_events (payment_attempt_id, received_at DESC);

CREATE TABLE payment_status_history (
    id UUID PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES orders(id),
    payment_attempt_id UUID REFERENCES payment_attempts(id),
    previous_status VARCHAR(12),
    status VARCHAR(12) NOT NULL
        CHECK (status IN ('UNPAID', 'PENDING', 'PAID', 'FAILED', 'CANCELLED', 'EXPIRED')),
    reason VARCHAR(120),
    changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_payment_status_history_order_time
    ON payment_status_history (order_id, changed_at DESC);

CREATE TABLE order_status_history (
    id UUID PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    status VARCHAR(12) NOT NULL
        CHECK (status IN (
            'PENDING', 'CONFIRMED', 'PROCESSING',
            'SHIPPING', 'DELIVERED', 'CANCELLED'
        )),
    actor_id UUID,
    actor_role VARCHAR(10)
        CHECK (actor_role IN ('USER', 'ADMIN', 'SYSTEM')),
    changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_order_status_history_order_time
    ON order_status_history (order_id, changed_at);

CREATE TABLE outbox_events (
    id UUID PRIMARY KEY,
    aggregate_id UUID NOT NULL,
    event_type VARCHAR(80) NOT NULL,
    payload JSONB NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    published_at TIMESTAMPTZ,
    publish_attempts INTEGER NOT NULL DEFAULT 0 CHECK (publish_attempts >= 0)
);
CREATE INDEX ix_outbox_events_pending
    ON outbox_events (created_at) WHERE published_at IS NULL;
