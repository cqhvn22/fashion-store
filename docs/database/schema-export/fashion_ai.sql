--
-- PostgreSQL database dump
--

\restrict vi0rtdi571bQQHFyyyFdpfFb2vTv5s3aQSqVERsWElUHfqgfoeoVDLs5pAokwbb

-- Dumped from database version 17.11
-- Dumped by pg_dump version 17.11

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_table_access_method = heap;

--
-- Name: chat_message_product_suggestions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_message_product_suggestions (
    message_id uuid NOT NULL,
    product_id uuid NOT NULL,
    "position" integer NOT NULL,
    CONSTRAINT chat_message_product_suggestions_position_check CHECK (("position" >= 0))
);


--
-- Name: chat_message_sources; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_message_sources (
    id uuid NOT NULL,
    message_id uuid NOT NULL,
    document_id uuid,
    chunk_id uuid,
    title character varying(250) NOT NULL,
    excerpt text,
    relevance_score double precision,
    source_url text,
    image_url text,
    CONSTRAINT chat_message_sources_relevance_score_check CHECK (((relevance_score IS NULL) OR ((relevance_score >= (0)::double precision) AND (relevance_score <= (1)::double precision))))
);


--
-- Name: chat_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_messages (
    id uuid NOT NULL,
    conversation_id uuid NOT NULL,
    role character varying(10) NOT NULL,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chat_messages_role_check CHECK (((role)::text = ANY ((ARRAY['USER'::character varying, 'ASSISTANT'::character varying])::text[])))
);


--
-- Name: conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversations (
    id uuid NOT NULL,
    user_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: knowledge_chunks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.knowledge_chunks (
    id uuid NOT NULL,
    document_id uuid NOT NULL,
    chunk_index integer NOT NULL,
    content text NOT NULL,
    embedding_model character varying(120),
    embedding double precision[],
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT knowledge_chunks_chunk_index_check CHECK ((chunk_index >= 0)),
    CONSTRAINT knowledge_chunks_embedding_check CHECK (((embedding IS NULL) OR (cardinality(embedding) > 0)))
);


--
-- Name: knowledge_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.knowledge_documents (
    id uuid NOT NULL,
    title character varying(250) NOT NULL,
    content text NOT NULL,
    status character varying(10) DEFAULT 'PENDING'::character varying NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    last_error text,
    indexed_at timestamp with time zone,
    CONSTRAINT knowledge_documents_status_check CHECK (((status)::text = ANY ((ARRAY['PENDING'::character varying, 'INDEXED'::character varying, 'FAILED'::character varying])::text[])))
);


--
-- Name: product_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_documents (
    id uuid NOT NULL,
    source character varying(12) NOT NULL,
    source_id character varying(100) NOT NULL,
    slug character varying(220) NOT NULL,
    name character varying(250) NOT NULL,
    category character varying(150) NOT NULL,
    price bigint NOT NULL,
    original_price bigint,
    colors text[] DEFAULT '{}'::text[] NOT NULL,
    sizes text[] DEFAULT '{}'::text[] NOT NULL,
    material text,
    image_url text,
    product_url text,
    in_stock boolean,
    content text NOT NULL,
    content_hash character(64) NOT NULL,
    embedding_model character varying(120) NOT NULL,
    embedding double precision[] NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT product_documents_embedding_check CHECK ((cardinality(embedding) > 0)),
    CONSTRAINT product_documents_price_check CHECK ((price >= 0)),
    CONSTRAINT product_documents_source_check CHECK (((source)::text = ANY ((ARRAY['workbook'::character varying, 'catalog'::character varying])::text[])))
);


--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_migrations (
    version integer NOT NULL,
    applied_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: chat_message_product_suggestions chat_message_product_suggestions_message_id_position_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_message_product_suggestions
    ADD CONSTRAINT chat_message_product_suggestions_message_id_position_key UNIQUE (message_id, "position");


--
-- Name: chat_message_product_suggestions chat_message_product_suggestions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_message_product_suggestions
    ADD CONSTRAINT chat_message_product_suggestions_pkey PRIMARY KEY (message_id, product_id);


--
-- Name: chat_message_sources chat_message_sources_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_message_sources
    ADD CONSTRAINT chat_message_sources_pkey PRIMARY KEY (id);


--
-- Name: chat_messages chat_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_pkey PRIMARY KEY (id);


--
-- Name: conversations conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_pkey PRIMARY KEY (id);


--
-- Name: knowledge_chunks knowledge_chunks_document_id_chunk_index_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_chunks
    ADD CONSTRAINT knowledge_chunks_document_id_chunk_index_key UNIQUE (document_id, chunk_index);


--
-- Name: knowledge_chunks knowledge_chunks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_chunks
    ADD CONSTRAINT knowledge_chunks_pkey PRIMARY KEY (id);


--
-- Name: knowledge_documents knowledge_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_documents
    ADD CONSTRAINT knowledge_documents_pkey PRIMARY KEY (id);


--
-- Name: product_documents product_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_documents
    ADD CONSTRAINT product_documents_pkey PRIMARY KEY (id);


--
-- Name: product_documents product_documents_source_source_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_documents
    ADD CONSTRAINT product_documents_source_source_id_key UNIQUE (source, source_id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: ix_chat_message_sources_message; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_chat_message_sources_message ON public.chat_message_sources USING btree (message_id);


--
-- Name: ix_chat_messages_conversation_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_chat_messages_conversation_time ON public.chat_messages USING btree (conversation_id, created_at);


--
-- Name: ix_conversations_user_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_conversations_user_time ON public.conversations USING btree (user_id, updated_at DESC);


--
-- Name: ix_knowledge_chunks_document; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_knowledge_chunks_document ON public.knowledge_chunks USING btree (document_id, chunk_index);


--
-- Name: ix_knowledge_documents_active_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_knowledge_documents_active_status ON public.knowledge_documents USING btree (is_active, status, updated_at DESC);


--
-- Name: ix_knowledge_documents_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_knowledge_documents_status ON public.knowledge_documents USING btree (status, updated_at DESC);


--
-- Name: ix_product_documents_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_product_documents_slug ON public.product_documents USING btree (slug);


--
-- Name: ix_product_documents_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_product_documents_source ON public.product_documents USING btree (source, source_id);


--
-- Name: chat_message_product_suggestions chat_message_product_suggestions_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_message_product_suggestions
    ADD CONSTRAINT chat_message_product_suggestions_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.chat_messages(id) ON DELETE CASCADE;


--
-- Name: chat_message_sources chat_message_sources_chunk_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_message_sources
    ADD CONSTRAINT chat_message_sources_chunk_id_fkey FOREIGN KEY (chunk_id) REFERENCES public.knowledge_chunks(id) ON DELETE SET NULL;


--
-- Name: chat_message_sources chat_message_sources_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_message_sources
    ADD CONSTRAINT chat_message_sources_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.knowledge_documents(id) ON DELETE SET NULL;


--
-- Name: chat_message_sources chat_message_sources_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_message_sources
    ADD CONSTRAINT chat_message_sources_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.chat_messages(id) ON DELETE CASCADE;


--
-- Name: chat_messages chat_messages_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: knowledge_chunks knowledge_chunks_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_chunks
    ADD CONSTRAINT knowledge_chunks_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.knowledge_documents(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict vi0rtdi571bQQHFyyyFdpfFb2vTv5s3aQSqVERsWElUHfqgfoeoVDLs5pAokwbb
