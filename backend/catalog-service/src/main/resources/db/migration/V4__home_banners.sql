CREATE TABLE home_banners (
    id UUID PRIMARY KEY,
    title VARCHAR(150) NOT NULL,
    subtitle VARCHAR(400) NOT NULL DEFAULT '',
    image_url TEXT NOT NULL,
    link_url VARCHAR(500) NOT NULL,
    button_label VARCHAR(60) NOT NULL DEFAULT 'Khám phá',
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_home_banners_active_order ON home_banners (is_active, sort_order);

INSERT INTO home_banners(id,title,subtitle,image_url,link_url,button_label,sort_order)
VALUES
('a1111111-1111-4111-8111-111111111111','Phong cách của bạn, mỗi ngày một mới.','Khám phá những thiết kế dễ mặc và vừa vặn với nhịp sống hiện đại.','https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1600&q=85','/products','Mua sắm ngay',0),
('a2222222-2222-4222-8222-222222222222','Bộ sưu tập mới','Tìm cảm hứng cho trang phục mỗi ngày.','https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1600&q=85','/products?sort=newest','Khám phá',1);
