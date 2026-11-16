--
-- PostgreSQL database dump
--

\restrict oVOswU0MXequibkTHf5pxVKaeYOzfdEpI4kvTuAtNnIMbH080GTXU3kaTp02euw

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
-- Name: cart_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cart_items (
    id uuid NOT NULL,
    cart_id uuid NOT NULL,
    product_id uuid NOT NULL,
    variant_id uuid NOT NULL,
    quantity integer NOT NULL,
    selected boolean DEFAULT true NOT NULL,
    added_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT cart_items_quantity_check CHECK ((quantity > 0))
);


--
-- Name: carts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.carts (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


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
-- Name: loyalty_points; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.loyalty_points (
    order_id uuid NOT NULL,
    user_id uuid NOT NULL,
    eligible_amount bigint NOT NULL,
    points bigint NOT NULL,
    earned_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT loyalty_points_eligible_amount_check CHECK ((eligible_amount >= 0)),
    CONSTRAINT loyalty_points_points_check CHECK ((points >= 0))
);


--
-- Name: loyalty_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.loyalty_settings (
    id boolean DEFAULT true NOT NULL,
    vnd_per_point bigint DEFAULT 1000 NOT NULL,
    window_months integer DEFAULT 6 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT loyalty_settings_id_check CHECK (id),
    CONSTRAINT loyalty_settings_vnd_per_point_check CHECK ((vnd_per_point > 0)),
    CONSTRAINT loyalty_settings_window_months_check CHECK (((window_months >= 1) AND (window_months <= 36)))
);


--
-- Name: loyalty_tiers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.loyalty_tiers (
    code character varying(12) NOT NULL,
    rank integer NOT NULL,
    min_orders integer NOT NULL,
    min_spend bigint NOT NULL,
    CONSTRAINT loyalty_tiers_code_check CHECK (((code)::text = ANY ((ARRAY['MEMBER'::character varying, 'SILVER'::character varying, 'GOLD'::character varying, 'DIAMOND'::character varying])::text[]))),
    CONSTRAINT loyalty_tiers_min_orders_check CHECK ((min_orders >= 0)),
    CONSTRAINT loyalty_tiers_min_spend_check CHECK ((min_spend >= 0)),
    CONSTRAINT loyalty_tiers_rank_check CHECK (((rank >= 0) AND (rank <= 3)))
);


--
-- Name: order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_items (
    id uuid NOT NULL,
    order_id uuid NOT NULL,
    product_id uuid NOT NULL,
    variant_id uuid NOT NULL,
    product_name character varying(250) NOT NULL,
    sku character varying(80) NOT NULL,
    image_url text,
    size character varying(40) NOT NULL,
    color character varying(80) NOT NULL,
    unit_price bigint NOT NULL,
    quantity integer NOT NULL,
    line_total bigint NOT NULL,
    CONSTRAINT order_items_check CHECK ((line_total = (unit_price * quantity))),
    CONSTRAINT order_items_line_total_check CHECK ((line_total >= 0)),
    CONSTRAINT order_items_quantity_check CHECK ((quantity > 0)),
    CONSTRAINT order_items_unit_price_check CHECK ((unit_price >= 0))
);


--
-- Name: order_status_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_status_history (
    id uuid NOT NULL,
    order_id uuid NOT NULL,
    status character varying(12) NOT NULL,
    actor_id uuid,
    actor_role character varying(10),
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT order_status_history_actor_role_check CHECK (((actor_role)::text = ANY ((ARRAY['USER'::character varying, 'ADMIN'::character varying, 'SYSTEM'::character varying])::text[]))),
    CONSTRAINT order_status_history_status_check CHECK (((status)::text = ANY ((ARRAY['PENDING'::character varying, 'CONFIRMED'::character varying, 'PROCESSING'::character varying, 'SHIPPING'::character varying, 'DELIVERED'::character varying, 'CANCELLED'::character varying])::text[])))
);


--
-- Name: orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orders (
    id uuid NOT NULL,
    order_code character varying(40) NOT NULL,
    user_id uuid NOT NULL,
    checkout_id uuid NOT NULL,
    idempotency_key character varying(120) NOT NULL,
    status character varying(12) DEFAULT 'PENDING'::character varying NOT NULL,
    payment_method character varying(20) DEFAULT 'COD'::character varying NOT NULL,
    payment_status character varying(12) NOT NULL,
    shipping_address jsonb NOT NULL,
    subtotal bigint NOT NULL,
    shipping_fee bigint NOT NULL,
    discount_amount bigint DEFAULT 0 NOT NULL,
    total_amount bigint NOT NULL,
    note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    tier_promotion_id uuid,
    CONSTRAINT orders_check CHECK ((total_amount = ((subtotal + shipping_fee) - discount_amount))),
    CONSTRAINT orders_check1 CHECK (((((payment_method)::text = 'COD'::text) AND ((payment_status)::text = ANY ((ARRAY['UNPAID'::character varying, 'PAID'::character varying, 'CANCELLED'::character varying])::text[]))) OR (((payment_method)::text = 'PAYOS'::text) AND ((payment_status)::text <> 'UNPAID'::text)))),
    CONSTRAINT orders_discount_amount_check CHECK ((discount_amount >= 0)),
    CONSTRAINT orders_payment_method_check CHECK (((payment_method)::text = ANY ((ARRAY['COD'::character varying, 'PAYOS'::character varying])::text[]))),
    CONSTRAINT orders_payment_status_check CHECK (((payment_status)::text = ANY ((ARRAY['UNPAID'::character varying, 'PENDING'::character varying, 'PAID'::character varying, 'FAILED'::character varying, 'CANCELLED'::character varying, 'EXPIRED'::character varying])::text[]))),
    CONSTRAINT orders_shipping_address_check CHECK ((jsonb_typeof(shipping_address) = 'object'::text)),
    CONSTRAINT orders_shipping_fee_check CHECK ((shipping_fee >= 0)),
    CONSTRAINT orders_status_check CHECK (((status)::text = ANY ((ARRAY['PENDING'::character varying, 'CONFIRMED'::character varying, 'PROCESSING'::character varying, 'SHIPPING'::character varying, 'DELIVERED'::character varying, 'CANCELLED'::character varying])::text[]))),
    CONSTRAINT orders_subtotal_check CHECK ((subtotal >= 0)),
    CONSTRAINT orders_total_amount_check CHECK ((total_amount >= 0))
);


--
-- Name: outbox_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.outbox_events (
    id uuid NOT NULL,
    aggregate_id uuid NOT NULL,
    event_type character varying(80) NOT NULL,
    payload jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    published_at timestamp with time zone,
    publish_attempts integer DEFAULT 0 NOT NULL,
    CONSTRAINT outbox_events_payload_check CHECK ((jsonb_typeof(payload) = 'object'::text)),
    CONSTRAINT outbox_events_publish_attempts_check CHECK ((publish_attempts >= 0))
);


--
-- Name: payment_attempts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_attempts (
    id uuid NOT NULL,
    order_id uuid NOT NULL,
    provider character varying(12) DEFAULT 'PAYOS'::character varying NOT NULL,
    provider_order_code bigint NOT NULL,
    payment_link_id character varying(120),
    checkout_url text,
    amount bigint NOT NULL,
    status character varying(12) DEFAULT 'PENDING'::character varying NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    paid_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT payment_attempts_amount_check CHECK ((amount > 0)),
    CONSTRAINT payment_attempts_check CHECK ((((status)::text <> 'PAID'::text) OR (paid_at IS NOT NULL))),
    CONSTRAINT payment_attempts_provider_check CHECK (((provider)::text = 'PAYOS'::text)),
    CONSTRAINT payment_attempts_provider_order_code_check CHECK ((provider_order_code > 0)),
    CONSTRAINT payment_attempts_status_check CHECK (((status)::text = ANY ((ARRAY['PENDING'::character varying, 'PAID'::character varying, 'FAILED'::character varying, 'CANCELLED'::character varying, 'EXPIRED'::character varying])::text[])))
);


--
-- Name: payment_status_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_status_history (
    id uuid NOT NULL,
    order_id uuid NOT NULL,
    payment_attempt_id uuid,
    previous_status character varying(12),
    status character varying(12) NOT NULL,
    reason character varying(120),
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT payment_status_history_status_check CHECK (((status)::text = ANY ((ARRAY['UNPAID'::character varying, 'PENDING'::character varying, 'PAID'::character varying, 'FAILED'::character varying, 'CANCELLED'::character varying, 'EXPIRED'::character varying])::text[])))
);


--
-- Name: payment_webhook_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_webhook_events (
    id uuid NOT NULL,
    payment_attempt_id uuid NOT NULL,
    payload_sha256 character(64) NOT NULL,
    provider_reference character varying(120),
    payload jsonb NOT NULL,
    received_at timestamp with time zone DEFAULT now() NOT NULL,
    processed_at timestamp with time zone,
    processing_error text,
    CONSTRAINT payment_webhook_events_payload_check CHECK ((jsonb_typeof(payload) = 'object'::text))
);


--
-- Name: payos_order_code_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.payos_order_code_seq
    START WITH 100000
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tier_promotions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tier_promotions (
    id uuid NOT NULL,
    name character varying(150) NOT NULL,
    eligible_tier character varying(12) NOT NULL,
    discount_type character varying(10) NOT NULL,
    discount_value bigint NOT NULL,
    min_subtotal bigint DEFAULT 0 NOT NULL,
    starts_at timestamp with time zone NOT NULL,
    ends_at timestamp with time zone NOT NULL,
    is_enabled boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT tier_promotions_check CHECK ((starts_at < ends_at)),
    CONSTRAINT tier_promotions_check1 CHECK ((((discount_type)::text <> 'PERCENT'::text) OR ((discount_value >= 1) AND (discount_value <= 99)))),
    CONSTRAINT tier_promotions_discount_type_check CHECK (((discount_type)::text = ANY ((ARRAY['PERCENT'::character varying, 'FIXED'::character varying])::text[]))),
    CONSTRAINT tier_promotions_discount_value_check CHECK ((discount_value > 0)),
    CONSTRAINT tier_promotions_eligible_tier_check CHECK (((eligible_tier)::text = ANY ((ARRAY['ALL'::character varying, 'MEMBER'::character varying, 'SILVER'::character varying, 'GOLD'::character varying, 'DIAMOND'::character varying])::text[]))),
    CONSTRAINT tier_promotions_min_subtotal_check CHECK ((min_subtotal >= 0))
);


--
-- Name: cart_items cart_items_cart_id_variant_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cart_items
    ADD CONSTRAINT cart_items_cart_id_variant_id_key UNIQUE (cart_id, variant_id);


--
-- Name: cart_items cart_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cart_items
    ADD CONSTRAINT cart_items_pkey PRIMARY KEY (id);


--
-- Name: carts carts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carts
    ADD CONSTRAINT carts_pkey PRIMARY KEY (id);


--
-- Name: carts carts_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carts
    ADD CONSTRAINT carts_user_id_key UNIQUE (user_id);


--
-- Name: flyway_schema_history flyway_schema_history_pk; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flyway_schema_history
    ADD CONSTRAINT flyway_schema_history_pk PRIMARY KEY (installed_rank);


--
-- Name: loyalty_points loyalty_points_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_points
    ADD CONSTRAINT loyalty_points_pkey PRIMARY KEY (order_id);


--
-- Name: loyalty_settings loyalty_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_settings
    ADD CONSTRAINT loyalty_settings_pkey PRIMARY KEY (id);


--
-- Name: loyalty_tiers loyalty_tiers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_tiers
    ADD CONSTRAINT loyalty_tiers_pkey PRIMARY KEY (code);


--
-- Name: loyalty_tiers loyalty_tiers_rank_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_tiers
    ADD CONSTRAINT loyalty_tiers_rank_key UNIQUE (rank);


--
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);


--
-- Name: order_status_history order_status_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_status_history
    ADD CONSTRAINT order_status_history_pkey PRIMARY KEY (id);


--
-- Name: orders orders_checkout_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_checkout_id_key UNIQUE (checkout_id);


--
-- Name: orders orders_order_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_order_code_key UNIQUE (order_code);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: orders orders_user_id_idempotency_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_user_id_idempotency_key_key UNIQUE (user_id, idempotency_key);


--
-- Name: outbox_events outbox_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.outbox_events
    ADD CONSTRAINT outbox_events_pkey PRIMARY KEY (id);


--
-- Name: payment_attempts payment_attempts_payment_link_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_attempts
    ADD CONSTRAINT payment_attempts_payment_link_id_key UNIQUE (payment_link_id);


--
-- Name: payment_attempts payment_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_attempts
    ADD CONSTRAINT payment_attempts_pkey PRIMARY KEY (id);


--
-- Name: payment_attempts payment_attempts_provider_order_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_attempts
    ADD CONSTRAINT payment_attempts_provider_order_code_key UNIQUE (provider_order_code);


--
-- Name: payment_status_history payment_status_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_status_history
    ADD CONSTRAINT payment_status_history_pkey PRIMARY KEY (id);


--
-- Name: payment_webhook_events payment_webhook_events_payload_sha256_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_webhook_events
    ADD CONSTRAINT payment_webhook_events_payload_sha256_key UNIQUE (payload_sha256);


--
-- Name: payment_webhook_events payment_webhook_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_webhook_events
    ADD CONSTRAINT payment_webhook_events_pkey PRIMARY KEY (id);


--
-- Name: tier_promotions tier_promotions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tier_promotions
    ADD CONSTRAINT tier_promotions_pkey PRIMARY KEY (id);


--
-- Name: flyway_schema_history_s_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX flyway_schema_history_s_idx ON public.flyway_schema_history USING btree (success);


--
-- Name: ix_cart_items_cart; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_cart_items_cart ON public.cart_items USING btree (cart_id);


--
-- Name: ix_loyalty_points_user_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_loyalty_points_user_time ON public.loyalty_points USING btree (user_id, earned_at DESC);


--
-- Name: ix_order_items_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_order_items_order ON public.order_items USING btree (order_id);


--
-- Name: ix_order_status_history_order_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_order_status_history_order_time ON public.order_status_history USING btree (order_id, changed_at);


--
-- Name: ix_orders_payment_status_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_orders_payment_status_time ON public.orders USING btree (payment_status, created_at DESC);


--
-- Name: ix_orders_status_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_orders_status_time ON public.orders USING btree (status, created_at DESC);


--
-- Name: ix_orders_user_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_orders_user_time ON public.orders USING btree (user_id, created_at DESC);


--
-- Name: ix_outbox_events_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_outbox_events_pending ON public.outbox_events USING btree (created_at) WHERE (published_at IS NULL);


--
-- Name: ix_payment_attempts_order_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_payment_attempts_order_time ON public.payment_attempts USING btree (order_id, created_at DESC);


--
-- Name: ix_payment_status_history_order_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_payment_status_history_order_time ON public.payment_status_history USING btree (order_id, changed_at DESC);


--
-- Name: ix_payment_webhook_events_attempt_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_payment_webhook_events_attempt_time ON public.payment_webhook_events USING btree (payment_attempt_id, received_at DESC);


--
-- Name: ix_tier_promotions_schedule; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_tier_promotions_schedule ON public.tier_promotions USING btree (starts_at, ends_at) WHERE is_enabled;


--
-- Name: ux_payment_attempts_active_order; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_payment_attempts_active_order ON public.payment_attempts USING btree (order_id) WHERE ((status)::text = 'PENDING'::text);


--
-- Name: cart_items cart_items_cart_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cart_items
    ADD CONSTRAINT cart_items_cart_id_fkey FOREIGN KEY (cart_id) REFERENCES public.carts(id) ON DELETE CASCADE;


--
-- Name: loyalty_points loyalty_points_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_points
    ADD CONSTRAINT loyalty_points_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: order_items order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: order_status_history order_status_history_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_status_history
    ADD CONSTRAINT order_status_history_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: orders orders_tier_promotion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_tier_promotion_id_fkey FOREIGN KEY (tier_promotion_id) REFERENCES public.tier_promotions(id);


--
-- Name: payment_attempts payment_attempts_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_attempts
    ADD CONSTRAINT payment_attempts_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: payment_status_history payment_status_history_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_status_history
    ADD CONSTRAINT payment_status_history_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: payment_status_history payment_status_history_payment_attempt_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_status_history
    ADD CONSTRAINT payment_status_history_payment_attempt_id_fkey FOREIGN KEY (payment_attempt_id) REFERENCES public.payment_attempts(id);


--
-- Name: payment_webhook_events payment_webhook_events_payment_attempt_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_webhook_events
    ADD CONSTRAINT payment_webhook_events_payment_attempt_id_fkey FOREIGN KEY (payment_attempt_id) REFERENCES public.payment_attempts(id);


--
-- PostgreSQL database dump complete
--

\unrestrict oVOswU0MXequibkTHf5pxVKaeYOzfdEpI4kvTuAtNnIMbH080GTXU3kaTp02euw
