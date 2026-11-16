CREATE TABLE knowledge_documents (
    id UUID PRIMARY KEY,
    title VARCHAR(250) NOT NULL,
    content TEXT NOT NULL,
    status VARCHAR(10) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'INDEXED', 'FAILED')),
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_knowledge_documents_status
    ON knowledge_documents (status, updated_at DESC);

CREATE TABLE knowledge_chunks (
    id UUID PRIMARY KEY,
    document_id UUID NOT NULL
        REFERENCES knowledge_documents(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL CHECK (chunk_index >= 0),
    content TEXT NOT NULL,
    embedding_model VARCHAR(120),
    embedding DOUBLE PRECISION[],
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (document_id, chunk_index),
    CHECK (embedding IS NULL OR cardinality(embedding) > 0)
);
CREATE INDEX ix_knowledge_chunks_document
    ON knowledge_chunks (document_id, chunk_index);

CREATE TABLE conversations (
    id UUID PRIMARY KEY,
    user_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_conversations_user_time
    ON conversations (user_id, updated_at DESC);

CREATE TABLE chat_messages (
    id UUID PRIMARY KEY,
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role VARCHAR(10) NOT NULL CHECK (role IN ('USER', 'ASSISTANT')),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_chat_messages_conversation_time
    ON chat_messages (conversation_id, created_at);

CREATE TABLE chat_message_sources (
    id UUID PRIMARY KEY,
    message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
    document_id UUID REFERENCES knowledge_documents(id) ON DELETE SET NULL,
    chunk_id UUID REFERENCES knowledge_chunks(id) ON DELETE SET NULL,
    title VARCHAR(250) NOT NULL,
    excerpt TEXT,
    relevance_score DOUBLE PRECISION
        CHECK (relevance_score IS NULL OR relevance_score BETWEEN 0 AND 1),
    source_url TEXT
);
CREATE INDEX ix_chat_message_sources_message
    ON chat_message_sources (message_id);

CREATE TABLE chat_message_product_suggestions (
    message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
    product_id UUID NOT NULL,
    position INTEGER NOT NULL CHECK (position >= 0),
    PRIMARY KEY (message_id, product_id),
    UNIQUE (message_id, position)
);
