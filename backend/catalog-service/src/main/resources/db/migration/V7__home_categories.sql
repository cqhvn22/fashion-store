CREATE TABLE IF NOT EXISTS home_categories (
    id UUID PRIMARY KEY,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    subtitle VARCHAR(400) NOT NULL DEFAULT '',
    selection_mode VARCHAR(20) NOT NULL DEFAULT 'ALL' CHECK (selection_mode IN ('ALL', 'CUSTOM')),
    product_ids TEXT NOT NULL DEFAULT '[]',
    display_limit INTEGER NOT NULL DEFAULT 8,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_home_categories_active_order ON home_categories (is_active, sort_order);

INSERT INTO home_categories(id, category_id, title, subtitle, selection_mode, product_ids, display_limit, sort_order, is_active)
VALUES
('b1111111-1111-4111-8111-111111111111', '9a371f76-0dc2-c5fd-0b02-896eac2a97e5', 'BỘ SƯU TẬP ÁO POLO', 'Thanh lịch, thoáng mát, chất liệu cotton cao cấp cho phái mạnh', 'ALL', '[]', 8, 0, true),
('b2222222-2222-4222-8222-222222222222', '90eae78b-2f4a-ff0b-5d5a-1b4f44f2f7e5', 'QUẦN SHORT NĂNG ĐỘNG', 'Thiết kế trẻ trung, thoáng nhẹ, dễ vận động cho ngày hè', 'ALL', '[]', 8, 1, true)
ON CONFLICT (id) DO NOTHING;
