CREATE INDEX ix_committed_sales_variant ON inventory_reservations (variant_id)
    INCLUDE (quantity) WHERE status = 'COMMITTED';
