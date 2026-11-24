CREATE TABLE loyalty_settings (
    id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id),
    vnd_per_point BIGINT NOT NULL DEFAULT 1000 CHECK (vnd_per_point > 0),
    window_months INTEGER NOT NULL DEFAULT 6 CHECK (window_months BETWEEN 1 AND 36),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO loyalty_settings(id) VALUES (true);

CREATE TABLE loyalty_tiers (
    code VARCHAR(12) PRIMARY KEY CHECK (code IN ('MEMBER','SILVER','GOLD','DIAMOND')),
    rank INTEGER NOT NULL UNIQUE CHECK (rank BETWEEN 0 AND 3),
    min_orders INTEGER NOT NULL CHECK (min_orders >= 0),
    min_spend BIGINT NOT NULL CHECK (min_spend >= 0)
);
INSERT INTO loyalty_tiers(code,rank,min_orders,min_spend) VALUES
('MEMBER',0,0,0),('SILVER',1,5,2000000),('GOLD',2,20,5000000),
('DIAMOND',3,50,15000000);

CREATE TABLE loyalty_points (
    order_id UUID PRIMARY KEY REFERENCES orders(id),
    user_id UUID NOT NULL,
    eligible_amount BIGINT NOT NULL CHECK (eligible_amount >= 0),
    points BIGINT NOT NULL CHECK (points >= 0),
    earned_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_loyalty_points_user_time ON loyalty_points(user_id,earned_at DESC);

-- Backfill only orders that are both delivered and paid. The order ID is the
-- idempotency key for future delivery/payment updates.
INSERT INTO loyalty_points(order_id,user_id,eligible_amount,points,earned_at)
SELECT id,user_id,greatest(0,subtotal-discount_amount),
       floor(greatest(0,subtotal-discount_amount)::numeric / 1000)::bigint,
       updated_at
FROM orders WHERE status='DELIVERED' AND payment_status='PAID'
ON CONFLICT (order_id) DO NOTHING;

CREATE TABLE tier_promotions (
    id UUID PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    eligible_tier VARCHAR(12) NOT NULL
        CHECK (eligible_tier IN ('ALL','MEMBER','SILVER','GOLD','DIAMOND')),
    discount_type VARCHAR(10) NOT NULL CHECK (discount_type IN ('PERCENT','FIXED')),
    discount_value BIGINT NOT NULL CHECK (discount_value > 0),
    min_subtotal BIGINT NOT NULL DEFAULT 0 CHECK (min_subtotal >= 0),
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (starts_at < ends_at),
    CHECK (discount_type <> 'PERCENT' OR discount_value BETWEEN 1 AND 99)
);
CREATE INDEX ix_tier_promotions_schedule
    ON tier_promotions(starts_at,ends_at) WHERE is_enabled;
ALTER TABLE orders ADD COLUMN tier_promotion_id UUID REFERENCES tier_promotions(id);
