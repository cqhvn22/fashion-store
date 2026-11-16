ALTER TABLE knowledge_documents
    ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN last_error TEXT,
    ADD COLUMN indexed_at TIMESTAMPTZ;

CREATE INDEX ix_knowledge_documents_active_status
    ON knowledge_documents (is_active, status, updated_at DESC);
