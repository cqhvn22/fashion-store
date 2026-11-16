--
-- PostgreSQL database dump
--

\restrict MzZsaxiqZ55xCbuKo8FHoDT0UcfC8Yw02nVkGQid1voxChXCNJQ7kiHjCsGoux8

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

--
-- Name: validate_category_parent(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_category_parent() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    PERFORM pg_advisory_xact_lock(24112601);
    IF NEW.parent_id IS NOT NULL AND EXISTS (
        WITH RECURSIVE ancestors(id, parent_id) AS (
            SELECT id, parent_id FROM categories WHERE id = NEW.parent_id
            UNION
            SELECT c.id, c.parent_id FROM categories c
            JOIN ancestors a ON c.id = a.parent_id
        )
        SELECT 1 FROM ancestors WHERE id = NEW.id
    ) THEN
        RAISE EXCEPTION 'CATEGORY_CYCLE: category cannot be its own ancestor'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;


SET default_table_access_method = heap;

--
-- Name: categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categories (
    id uuid NOT NULL,
    parent_id uuid,
    name character varying(150) NOT NULL,
    slug character varying(180) NOT NULL,
    description text,
    image_url text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT categories_check CHECK (((parent_id IS NULL) OR (parent_id <> id)))
);


--
-- Name: product_promotions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_promotions (
    id uuid NOT NULL,
    product_id uuid NOT NULL,
    name character varying(150) NOT NULL,
    discount_type character varying(10) NOT NULL,
    discount_value bigint NOT NULL,
    starts_at timestamp with time zone NOT NULL,
    ends_at timestamp with time zone NOT NULL,
    is_enabled boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT product_promotions_check CHECK ((starts_at < ends_at)),
    CONSTRAINT product_promotions_check1 CHECK ((((discount_type)::text <> 'PERCENT'::text) OR ((discount_value >= 1) AND (discount_value <= 99)))),
    CONSTRAINT product_promotions_discount_type_check CHECK (((discount_type)::text = ANY ((ARRAY['PERCENT'::character varying, 'FIXED'::character varying])::text[]))),
    CONSTRAINT product_promotions_discount_value_check CHECK ((discount_value > 0))
);


--
-- Name: product_variants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_variants (
    id uuid NOT NULL,
    product_id uuid NOT NULL,
    sku character varying(80) NOT NULL,
    color character varying(80) NOT NULL,
    color_code character varying(20),
    size character varying(40) NOT NULL,
    price bigint NOT NULL,
    stock_quantity integer DEFAULT 0 NOT NULL,
    reserved_quantity integer DEFAULT 0 NOT NULL,
    image_url text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT product_variants_check CHECK ((reserved_quantity <= stock_quantity)),
    CONSTRAINT product_variants_price_check CHECK ((price >= 0)),
    CONSTRAINT product_variants_reserved_quantity_check CHECK ((reserved_quantity >= 0)),
    CONSTRAINT product_variants_stock_quantity_check CHECK ((stock_quantity >= 0))
);


--
-- Name: current_variant_prices; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.current_variant_prices AS
 SELECT v.id AS variant_id,
    v.price AS regular_price,
        CASE
            WHEN (promotion.id IS NULL) THEN v.price
            WHEN ((promotion.discount_type)::text = 'PERCENT'::text) THEN GREATEST((1000)::bigint, (floor((((v.price)::numeric * ((100 - promotion.discount_value))::numeric) / (100)::numeric)))::bigint)
            ELSE GREATEST((1000)::bigint, (v.price - promotion.discount_value))
        END AS effective_price,
    promotion.id AS promotion_id
   FROM (public.product_variants v
     LEFT JOIN LATERAL ( SELECT p.id,
            p.discount_type,
            p.discount_value
           FROM public.product_promotions p
          WHERE ((p.product_id = v.product_id) AND p.is_enabled AND (p.starts_at <= now()) AND (p.ends_at > now()))
          ORDER BY p.starts_at DESC, p.created_at DESC
         LIMIT 1) promotion ON (true));


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
-- Name: home_banners; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.home_banners (
    id uuid NOT NULL,
    title character varying(150) NOT NULL,
    subtitle character varying(400) DEFAULT ''::character varying NOT NULL,
    image_url text NOT NULL,
    link_url character varying(500) NOT NULL,
    button_label character varying(60) DEFAULT 'Khám phá'::character varying NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: home_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.home_categories (
    id uuid NOT NULL,
    category_id uuid NOT NULL,
    title character varying(150) NOT NULL,
    subtitle character varying(400) DEFAULT ''::character varying NOT NULL,
    selection_mode character varying(20) DEFAULT 'ALL'::character varying NOT NULL,
    product_ids text DEFAULT '[]'::text NOT NULL,
    display_limit integer DEFAULT 8 NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT home_categories_selection_mode_check CHECK (((selection_mode)::text = ANY ((ARRAY['ALL'::character varying, 'CUSTOM'::character varying])::text[])))
);


--
-- Name: inventory_movements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_movements (
    id uuid NOT NULL,
    variant_id uuid NOT NULL,
    delta integer NOT NULL,
    reason character varying(20) NOT NULL,
    reference_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT inventory_movements_delta_check CHECK ((delta <> 0)),
    CONSTRAINT inventory_movements_reason_check CHECK (((reason)::text = ANY ((ARRAY['ADMIN_ADJUST'::character varying, 'ORDER_COMMIT'::character varying, 'ORDER_CANCEL'::character varying])::text[])))
);


--
-- Name: inventory_reservations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_reservations (
    id uuid NOT NULL,
    checkout_id uuid NOT NULL,
    variant_id uuid NOT NULL,
    quantity integer NOT NULL,
    status character varying(12) DEFAULT 'RESERVED'::character varying NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT inventory_reservations_quantity_check CHECK ((quantity > 0)),
    CONSTRAINT inventory_reservations_status_check CHECK (((status)::text = ANY ((ARRAY['RESERVED'::character varying, 'COMMITTED'::character varying, 'RELEASED'::character varying])::text[])))
);


--
-- Name: product_images; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_images (
    id uuid NOT NULL,
    product_id uuid NOT NULL,
    url text NOT NULL,
    alt character varying(250) DEFAULT ''::character varying NOT NULL,
    is_primary boolean DEFAULT false NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL
);


--
-- Name: product_reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_reviews (
    id uuid NOT NULL,
    order_id uuid NOT NULL,
    order_item_id uuid NOT NULL,
    user_id uuid NOT NULL,
    product_id uuid NOT NULL,
    variant_id uuid NOT NULL,
    size character varying(40) NOT NULL,
    color character varying(80) NOT NULL,
    rating smallint NOT NULL,
    content character varying(2000) NOT NULL,
    status character varying(8) DEFAULT 'VISIBLE'::character varying NOT NULL,
    edit_count smallint DEFAULT 0 NOT NULL,
    seller_reply character varying(1000),
    replied_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT product_reviews_content_check CHECK (((length(TRIM(BOTH FROM content)) >= 10) AND (length(TRIM(BOTH FROM content)) <= 2000))),
    CONSTRAINT product_reviews_edit_count_check CHECK (((edit_count >= 0) AND (edit_count <= 1))),
    CONSTRAINT product_reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5))),
    CONSTRAINT product_reviews_status_check CHECK (((status)::text = ANY ((ARRAY['VISIBLE'::character varying, 'HIDDEN'::character varying])::text[])))
);


--
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products (
    id uuid NOT NULL,
    category_id uuid NOT NULL,
    slug character varying(220) NOT NULL,
    name character varying(250) NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    brand character varying(120),
    status character varying(10) DEFAULT 'DRAFT'::character varying NOT NULL,
    original_price bigint,
    rating_average numeric(3,2) DEFAULT 0 NOT NULL,
    review_count integer DEFAULT 0 NOT NULL,
    sold_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT products_original_price_check CHECK (((original_price IS NULL) OR (original_price >= 0))),
    CONSTRAINT products_rating_average_check CHECK (((rating_average >= (0)::numeric) AND (rating_average <= (5)::numeric))),
    CONSTRAINT products_review_count_check CHECK ((review_count >= 0)),
    CONSTRAINT products_sold_count_check CHECK ((sold_count >= 0)),
    CONSTRAINT products_status_check CHECK (((status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'INACTIVE'::character varying, 'DRAFT'::character varying])::text[])))
);


--
-- Name: review_images; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.review_images (
    id uuid NOT NULL,
    review_id uuid NOT NULL,
    url text NOT NULL,
    sort_order smallint DEFAULT 0 NOT NULL
);


--
-- Name: variant_images; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.variant_images (
    id uuid NOT NULL,
    variant_id uuid NOT NULL,
    url text NOT NULL,
    alt character varying(250) DEFAULT ''::character varying NOT NULL,
    is_primary boolean DEFAULT false NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL
);


--
-- Name: wishlist_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wishlist_items (
    user_id uuid NOT NULL,
    product_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: categories categories_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_slug_key UNIQUE (slug);


--
-- Name: flyway_schema_history flyway_schema_history_pk; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flyway_schema_history
    ADD CONSTRAINT flyway_schema_history_pk PRIMARY KEY (installed_rank);


--
-- Name: home_banners home_banners_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.home_banners
    ADD CONSTRAINT home_banners_pkey PRIMARY KEY (id);


--
-- Name: home_categories home_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.home_categories
    ADD CONSTRAINT home_categories_pkey PRIMARY KEY (id);


--
-- Name: inventory_movements inventory_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT inventory_movements_pkey PRIMARY KEY (id);


--
-- Name: inventory_reservations inventory_reservations_checkout_id_variant_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_reservations
    ADD CONSTRAINT inventory_reservations_checkout_id_variant_id_key UNIQUE (checkout_id, variant_id);


--
-- Name: inventory_reservations inventory_reservations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_reservations
    ADD CONSTRAINT inventory_reservations_pkey PRIMARY KEY (id);


--
-- Name: product_images product_images_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_images
    ADD CONSTRAINT product_images_pkey PRIMARY KEY (id);


--
-- Name: product_promotions product_promotions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_promotions
    ADD CONSTRAINT product_promotions_pkey PRIMARY KEY (id);


--
-- Name: product_reviews product_reviews_order_item_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_reviews
    ADD CONSTRAINT product_reviews_order_item_id_key UNIQUE (order_item_id);


--
-- Name: product_reviews product_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_reviews
    ADD CONSTRAINT product_reviews_pkey PRIMARY KEY (id);


--
-- Name: product_variants product_variants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_variants
    ADD CONSTRAINT product_variants_pkey PRIMARY KEY (id);


--
-- Name: product_variants product_variants_sku_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_variants
    ADD CONSTRAINT product_variants_sku_key UNIQUE (sku);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: products products_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_slug_key UNIQUE (slug);


--
-- Name: review_images review_images_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_images
    ADD CONSTRAINT review_images_pkey PRIMARY KEY (id);


--
-- Name: variant_images variant_images_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.variant_images
    ADD CONSTRAINT variant_images_pkey PRIMARY KEY (id);


--
-- Name: wishlist_items wishlist_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wishlist_items
    ADD CONSTRAINT wishlist_items_pkey PRIMARY KEY (user_id, product_id);


--
-- Name: flyway_schema_history_s_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX flyway_schema_history_s_idx ON public.flyway_schema_history USING btree (success);


--
-- Name: ix_categories_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_categories_parent ON public.categories USING btree (parent_id);


--
-- Name: ix_home_banners_active_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_home_banners_active_order ON public.home_banners USING btree (is_active, sort_order);


--
-- Name: ix_home_categories_active_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_home_categories_active_order ON public.home_categories USING btree (is_active, sort_order);


--
-- Name: ix_inventory_movements_variant_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_inventory_movements_variant_time ON public.inventory_movements USING btree (variant_id, created_at DESC);


--
-- Name: ix_inventory_reservations_expiry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_inventory_reservations_expiry ON public.inventory_reservations USING btree (expires_at) WHERE ((status)::text = 'RESERVED'::text);


--
-- Name: ix_product_images_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_product_images_product ON public.product_images USING btree (product_id, sort_order);


--
-- Name: ix_product_promotions_schedule; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_product_promotions_schedule ON public.product_promotions USING btree (product_id, starts_at, ends_at) WHERE is_enabled;


--
-- Name: ix_product_reviews_product_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_product_reviews_product_time ON public.product_reviews USING btree (product_id, created_at DESC) WHERE ((status)::text = 'VISIBLE'::text);


--
-- Name: ix_product_reviews_user_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_product_reviews_user_order ON public.product_reviews USING btree (user_id, order_id);


--
-- Name: ix_product_variants_filter; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_product_variants_filter ON public.product_variants USING btree (size, color, price);


--
-- Name: ix_product_variants_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_product_variants_product ON public.product_variants USING btree (product_id);


--
-- Name: ix_products_category_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_products_category_status ON public.products USING btree (category_id, status);


--
-- Name: ix_products_name_search; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_products_name_search ON public.products USING btree (lower((name)::text));


--
-- Name: ix_review_images_review; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_review_images_review ON public.review_images USING btree (review_id, sort_order);


--
-- Name: ix_variant_images_variant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_variant_images_variant ON public.variant_images USING btree (variant_id, sort_order);


--
-- Name: ux_product_images_primary; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_product_images_primary ON public.product_images USING btree (product_id) WHERE is_primary;


--
-- Name: ux_variant_images_primary; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_variant_images_primary ON public.variant_images USING btree (variant_id) WHERE is_primary;


--
-- Name: categories trg_validate_category_parent; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_validate_category_parent BEFORE INSERT OR UPDATE OF parent_id ON public.categories FOR EACH ROW EXECUTE FUNCTION public.validate_category_parent();


--
-- Name: categories categories_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.categories(id) ON DELETE RESTRICT;


--
-- Name: home_categories home_categories_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.home_categories
    ADD CONSTRAINT home_categories_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE CASCADE;


--
-- Name: inventory_movements inventory_movements_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT inventory_movements_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id) ON DELETE RESTRICT;


--
-- Name: inventory_reservations inventory_reservations_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_reservations
    ADD CONSTRAINT inventory_reservations_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id) ON DELETE RESTRICT;


--
-- Name: product_images product_images_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_images
    ADD CONSTRAINT product_images_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: product_promotions product_promotions_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_promotions
    ADD CONSTRAINT product_promotions_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: product_reviews product_reviews_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_reviews
    ADD CONSTRAINT product_reviews_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: product_variants product_variants_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_variants
    ADD CONSTRAINT product_variants_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: products products_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE RESTRICT;


--
-- Name: review_images review_images_review_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_images
    ADD CONSTRAINT review_images_review_id_fkey FOREIGN KEY (review_id) REFERENCES public.product_reviews(id) ON DELETE CASCADE;


--
-- Name: variant_images variant_images_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.variant_images
    ADD CONSTRAINT variant_images_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id) ON DELETE CASCADE;


--
-- Name: wishlist_items wishlist_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wishlist_items
    ADD CONSTRAINT wishlist_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict MzZsaxiqZ55xCbuKo8FHoDT0UcfC8Yw02nVkGQid1voxChXCNJQ7kiHjCsGoux8
