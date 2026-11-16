--
-- PostgreSQL database dump
--

\restrict nch4Dx1oZAeAn59NxReC7PxAlqXydtlqt65RI1nfXPOhg2ESSkfRA2mZA275ciG

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
-- Name: flyway_schema_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.flyway_schema_history (
    installed_rank integer NOT NULL,
    version character varying(50),
    description character varying(200) NOT NULL,
    type character varying(20) NOT NULL,
    script character varying(1000) NOT NULL,
    checksum integer,
    installed_by character varying(100) NOT NULL,
    installed_on timestamp without time zone DEFAULT now() NOT NULL,
    execution_time integer NOT NULL,
    success boolean NOT NULL
);


--
-- Name: notification_attempts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_attempts (
    id uuid NOT NULL,
    notification_id uuid NOT NULL,
    attempted_at timestamp with time zone DEFAULT now() NOT NULL,
    success boolean NOT NULL,
    provider_message_id character varying(255),
    error_message text
);


--
-- Name: notification_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_templates (
    id uuid NOT NULL,
    code character varying(80) NOT NULL,
    channel character varying(10) NOT NULL,
    subject character varying(250),
    body text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT notification_templates_channel_check CHECK (((channel)::text = ANY ((ARRAY['EMAIL'::character varying, 'SMS'::character varying, 'IN_APP'::character varying])::text[])))
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid NOT NULL,
    event_id uuid NOT NULL,
    template_id uuid,
    recipient_user_id uuid NOT NULL,
    order_id uuid,
    channel character varying(10) NOT NULL,
    destination character varying(255) NOT NULL,
    subject character varying(250),
    body text NOT NULL,
    status character varying(12) DEFAULT 'PENDING'::character varying NOT NULL,
    attempt_count integer DEFAULT 0 NOT NULL,
    next_attempt_at timestamp with time zone,
    sent_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    read_at timestamp with time zone,
    CONSTRAINT notifications_attempt_count_check CHECK ((attempt_count >= 0)),
    CONSTRAINT notifications_channel_check CHECK (((channel)::text = ANY ((ARRAY['EMAIL'::character varying, 'SMS'::character varying, 'IN_APP'::character varying])::text[]))),
    CONSTRAINT notifications_status_check CHECK (((status)::text = ANY ((ARRAY['PENDING'::character varying, 'SENT'::character varying, 'FAILED'::character varying])::text[])))
);


--
-- Name: processed_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.processed_events (
    event_id uuid NOT NULL,
    event_type character varying(80) NOT NULL,
    processed_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: flyway_schema_history flyway_schema_history_pk; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flyway_schema_history
    ADD CONSTRAINT flyway_schema_history_pk PRIMARY KEY (installed_rank);


--
-- Name: notification_attempts notification_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_attempts
    ADD CONSTRAINT notification_attempts_pkey PRIMARY KEY (id);


--
-- Name: notification_templates notification_templates_code_channel_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_templates
    ADD CONSTRAINT notification_templates_code_channel_key UNIQUE (code, channel);


--
-- Name: notification_templates notification_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_templates
    ADD CONSTRAINT notification_templates_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_event_id_recipient_user_id_channel_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_event_id_recipient_user_id_channel_key UNIQUE (event_id, recipient_user_id, channel);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: processed_events processed_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.processed_events
    ADD CONSTRAINT processed_events_pkey PRIMARY KEY (event_id);


--
-- Name: flyway_schema_history_s_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX flyway_schema_history_s_idx ON public.flyway_schema_history USING btree (success);


--
-- Name: ix_notification_attempts_notification; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_notification_attempts_notification ON public.notification_attempts USING btree (notification_id, attempted_at DESC);


--
-- Name: ix_notifications_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_notifications_pending ON public.notifications USING btree (next_attempt_at, created_at) WHERE ((status)::text = ANY ((ARRAY['PENDING'::character varying, 'FAILED'::character varying])::text[]));


--
-- Name: ix_notifications_recipient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_notifications_recipient ON public.notifications USING btree (recipient_user_id, created_at DESC);


--
-- Name: ix_notifications_unread_recipient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_notifications_unread_recipient ON public.notifications USING btree (recipient_user_id, created_at DESC) WHERE (read_at IS NULL);


--
-- Name: notification_attempts notification_attempts_notification_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_attempts
    ADD CONSTRAINT notification_attempts_notification_id_fkey FOREIGN KEY (notification_id) REFERENCES public.notifications(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.processed_events(event_id);


--
-- Name: notifications notifications_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.notification_templates(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict nch4Dx1oZAeAn59NxReC7PxAlqXydtlqt65RI1nfXPOhg2ESSkfRA2mZA275ciG
