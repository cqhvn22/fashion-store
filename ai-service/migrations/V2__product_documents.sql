CREATE TABLE product_documents (
    id UUID PRIMARY KEY,
    source VARCHAR(12) NOT NULL CHECK (source IN ('workbook', 'catalog')),
    source_id VARCHAR(100) NOT NULL,
    slug VARCHAR(220) NOT NULL,
    name VARCHAR(250) NOT NULL,
    category VARCHAR(150) NOT NULL,
    price BIGINT NOT NULL CHECK (price >= 0),
    original_price BIGINT,
    colors TEXT[] NOT NULL DEFAULT '{}',
    sizes TEXT[] NOT NULL DEFAULT '{}',
    material TEXT,
    image_url TEXT,
    product_url TEXT,
    in_stock BOOLEAN,
    content TEXT NOT NULL,
    content_hash CHAR(64) NOT NULL,
    embedding_model VARCHAR(120) NOT NULL,
    embedding DOUBLE PRECISION[] NOT NULL CHECK (cardinality(embedding) > 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (source, source_id)
);
CREATE INDEX ix_product_documents_source ON product_documents(source, source_id);
CREATE INDEX ix_product_documents_slug ON product_documents(slug);
