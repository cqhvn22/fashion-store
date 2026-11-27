package com.fashion.catalog;

import com.fashion.common.Api;
import com.fashion.common.Sql;
import jakarta.annotation.security.RolesAllowed;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import java.sql.Connection;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import javax.sql.DataSource;
import org.eclipse.microprofile.jwt.JsonWebToken;

@Path("/api/v1")
@Consumes(MediaType.APPLICATION_JSON)
@Produces(MediaType.APPLICATION_JSON)
public class CatalogResource {
    private static final String SOLD_QUANTITY = "(SELECT COALESCE(sum(r.quantity),0) "
            + "FROM inventory_reservations r JOIN product_variants v ON v.id=r.variant_id "
            + "WHERE v.product_id=p.id AND r.status='COMMITTED')";
    private static final String VISIBLE_CATEGORY_IDS = "WITH RECURSIVE visible AS ("
            + "SELECT id FROM categories WHERE parent_id IS NULL AND is_active=true "
            + "UNION ALL SELECT child.id FROM categories child JOIN visible v ON child.parent_id=v.id "
            + "WHERE child.is_active=true) SELECT id FROM visible";
    @Inject DataSource database;
    @Inject JsonWebToken jwt;
    @Inject AiIndexNotifier aiIndex;
    @Inject PublicCatalogCache readCache;

    public record CategoryInput(String name, String slug, String description,
            String imageUrl, UUID parentId, Boolean isActive) {}
    public record ImageInput(String url, String alt, Boolean isPrimary) {}
    public record VariantImageInput(String url, String alt, Boolean isPrimary) {}
    public record VariantInput(UUID id, String sku, String color, String colorCode,
            String size, Long price, Integer stockQuantity, String imageUrl, Boolean isActive,
            List<VariantImageInput> images) {}
    public record ProductInput(String name, String slug, String description, UUID categoryId,
            String brand, String status, Long originalPrice,
            List<ImageInput> images, List<VariantInput> variants) {}

    @GET @Path("/categories")
    public Map<String, Object> categories() {
        return Api.ok(readCache.get(PublicCatalogCache.CATEGORIES, () -> Sql.list(database,
                "WITH RECURSIVE visible AS (SELECT id,parent_id,name,slug,description,image_url,is_active FROM categories WHERE parent_id IS NULL AND is_active=true "
                + "UNION ALL SELECT c.id,c.parent_id,c.name,c.slug,c.description,c.image_url,c.is_active FROM categories c JOIN visible v ON c.parent_id=v.id WHERE c.is_active=true) "
                + "SELECT id,parent_id,name,slug,description,image_url,is_active FROM visible ORDER BY name")));
    }

    @GET @Path("/admin/categories")
    @RolesAllowed("ADMIN")
    public Map<String, Object> adminCategories() {
        return Api.ok(Sql.list(database,
                "SELECT id,parent_id,name,slug,description,image_url,is_active FROM categories ORDER BY name"));
    }

    @POST @Path("/admin/categories")
    @RolesAllowed("ADMIN")
    public Map<String, Object> createCategory(CategoryInput input) {
        validateCategory(input);
        validateParent(null, input.parentId());
        UUID id = UUID.randomUUID();
        Sql.update(database, "INSERT INTO categories(id,parent_id,name,slug,description,image_url,is_active) VALUES (?,?,?,?,?,?,?)",
                id, input.parentId(), input.name(), input.slug(), input.description(),
                input.imageUrl(), input.isActive() == null || input.isActive());
        readCache.invalidate(PublicCatalogCache.CATEGORIES, PublicCatalogCache.HOME_CATEGORIES);
        aiIndex.productChanged();
        return Api.ok(category(id));
    }

    @PUT @Path("/admin/categories/{id}")
    @RolesAllowed("ADMIN")
    public Map<String, Object> updateCategory(@PathParam("id") UUID id, CategoryInput input) {
        validateCategory(input);
        Api.require(categoryExists(id), 404, "NOT_FOUND", "Không tìm thấy danh mục");
        validateParent(id, input.parentId());
        Api.require(Sql.update(database,
                "UPDATE categories SET parent_id=?,name=?,slug=?,description=?,image_url=?,is_active=?,updated_at=now() WHERE id=?",
                input.parentId(), input.name(), input.slug(), input.description(), input.imageUrl(),
                input.isActive() == null || input.isActive(), id) == 1,
                404, "NOT_FOUND", "Không tìm thấy danh mục");
        readCache.invalidate(PublicCatalogCache.CATEGORIES, PublicCatalogCache.HOME_CATEGORIES);
        aiIndex.productChanged();
        return Api.ok(category(id));
    }

    @DELETE @Path("/admin/categories/{id}")
    @RolesAllowed("ADMIN")
    public Map<String, Object> deleteCategory(@PathParam("id") UUID id) {
        Api.require(Sql.one(database, "SELECT id FROM categories WHERE parent_id=? LIMIT 1", id) == null,
                409, "CATEGORY_HAS_CHILDREN", "Danh mục đang có danh mục con");
        Api.require(Sql.one(database, "SELECT id FROM products WHERE category_id=? LIMIT 1", id) == null,
                409, "CATEGORY_IN_USE", "Danh mục đang có sản phẩm");
        Api.require(Sql.update(database, "DELETE FROM categories WHERE id=?", id) == 1,
                404, "NOT_FOUND", "Không tìm thấy danh mục");
        readCache.invalidate(PublicCatalogCache.CATEGORIES, PublicCatalogCache.HOME_CATEGORIES);
        aiIndex.productChanged();
        return Api.ok(Map.of());
    }

    @GET @Path("/products")
    public Map<String, Object> products(@QueryParam("category") String category,
            @QueryParam("q") String query, @QueryParam("minPrice") Long minPrice,
            @QueryParam("maxPrice") Long maxPrice, @QueryParam("size") String size,
            @QueryParam("color") String color, @QueryParam("sort") String sort,
            @DefaultValue("1") @QueryParam("page") int page,
            @DefaultValue("12") @QueryParam("limit") int limit) {
        return search(false, category, query, minPrice, maxPrice, size, color, sort, page, limit);
    }

    @GET @Path("/products/home-selection")
    public Map<String, Object> homeSelection(@QueryParam("section") String section,
            @QueryParam("seed") long seed, @QueryParam("showcaseId") UUID showcaseId) {
        int limit = 8;
        String scope = "";
        String poolOrder = "";
        List<Object> args = new ArrayList<>();
        args.add(seed);
        switch (section == null ? "" : section) {
            case "new" -> poolOrder = " ORDER BY p.created_at DESC, shuffle LIMIT 32";
            case "popular" -> poolOrder = " ORDER BY sold DESC, shuffle LIMIT 32";
            case "sale" -> scope = " AND EXISTS (SELECT 1 FROM product_variants v "
                    + "JOIN current_variant_prices cp ON cp.variant_id=v.id WHERE v.product_id=p.id "
                    + "AND v.is_active AND cp.effective_price<v.price)";
            case "category" -> {
                Map<String, Object> config = Sql.one(database, "SELECT hc.* FROM home_categories hc "
                        + "WHERE hc.id=? AND hc.is_active AND hc.category_id IN (" + VISIBLE_CATEGORY_IDS + ")", showcaseId);
                if (config == null) return Api.ok(List.of());
                limit = ((Number) config.get("displayLimit")).intValue();
                if ("CUSTOM".equals(config.get("selectionMode"))) {
                    scope = " AND p.id::text IN (SELECT jsonb_array_elements_text(CAST(? AS jsonb)))";
                    args.add(config.get("productIds"));
                } else {
                    scope = " AND p.category_id IN (WITH RECURSIVE descendants(id) AS (SELECT CAST(? AS uuid) "
                            + "UNION SELECT c.id FROM categories c JOIN descendants d ON c.parent_id=d.id) SELECT id FROM descendants)";
                    args.add(config.get("categoryId"));
                }
            }
            default -> throw new BadRequestException("Unknown home section");
        }
        // Reserve a quarter of the shelf for its strongest sellers; rotate the other slots.
        args.add(Math.max(1, limit / 4));
        args.add(limit);
        String sql = "WITH pool AS (SELECT p.id," + SOLD_QUANTITY + " AS sold,"
                + "md5(p.id::text || CAST(? AS text)) AS shuffle FROM products p WHERE p.status='ACTIVE' "
                + "AND p.category_id IN (" + VISIBLE_CATEGORY_IDS + ")" + scope + poolOrder + "), "
                + "ranked AS (SELECT *, row_number() OVER (ORDER BY sold DESC, shuffle) AS pos FROM pool), "
                + "picked AS (SELECT * FROM ranked ORDER BY (sold>0 AND pos<=?) DESC, shuffle LIMIT ?) "
                + "SELECT id FROM picked ORDER BY sold DESC, shuffle";
        return Api.ok(Sql.list(database, sql, args.toArray()).stream()
                .map(row -> product((UUID) row.get("id"), false)).toList());
    }

    @GET @Path("/admin/products")
    @RolesAllowed("ADMIN")
    public Map<String, Object> adminProducts(@QueryParam("q") String query,
            @DefaultValue("1") @QueryParam("page") int page,
            @DefaultValue("12") @QueryParam("limit") int limit) {
        return search(true, null, query, null, null, null, null, null, page, limit);
    }

    @GET @Path("/products/slug/{slug}")
    public Map<String, Object> bySlug(@PathParam("slug") String slug) {
        Map<String, Object> row = Sql.one(database,
                "SELECT id FROM products WHERE slug=? AND status='ACTIVE'", slug);
        Api.require(row != null, 404, "NOT_FOUND", "Không tìm thấy sản phẩm");
        return Api.ok(product((UUID) row.get("id"), false));
    }

    @GET @Path("/products/{id}")
    public Map<String, Object> byId(@PathParam("id") UUID id) {
        return Api.ok(product(id, false));
    }

    @GET @Path("/admin/products/{id}")
    @RolesAllowed("ADMIN")
    public Map<String, Object> adminById(@PathParam("id") UUID id) {
        return Api.ok(product(id, true));
    }

    @POST @Path("/admin/products")
    @RolesAllowed("ADMIN")
    public Map<String, Object> createProduct(ProductInput input) {
        UUID id = UUID.randomUUID();
        saveProduct(id, input, true);
        aiIndex.productChanged();
        return Api.ok(product(id, true));
    }

    @PUT @Path("/admin/products/{id}")
    @RolesAllowed("ADMIN")
    public Map<String, Object> updateProduct(@PathParam("id") UUID id, ProductInput input) {
        saveProduct(id, input, false);
        aiIndex.productChanged();
        return Api.ok(product(id, true));
    }

    @DELETE @Path("/admin/products/{id}")
    @RolesAllowed("ADMIN")
    public Map<String, Object> deactivateProduct(@PathParam("id") UUID id) {
        Sql.update(database,
                "DELETE FROM inventory_reservations WHERE variant_id IN (SELECT id FROM product_variants WHERE product_id = ?)", id);
        Sql.update(database,
                "DELETE FROM inventory_movements WHERE variant_id IN (SELECT id FROM product_variants WHERE product_id = ?)", id);
        int rows = Sql.update(database, "DELETE FROM products WHERE id=?", id);
        if (rows == 0) {
            Sql.update(database, "UPDATE products SET status='INACTIVE',updated_at=now() WHERE id=?", id);
        }
        aiIndex.productChanged();
        return Api.ok(Map.of("success", true));
    }

    @GET @Path("/wishlist")
    @RolesAllowed({"USER", "ADMIN"})
    public Map<String, Object> wishlist() {
        List<Map<String, Object>> rows = Sql.list(database,
                "SELECT product_id FROM wishlist_items WHERE user_id=? ORDER BY created_at DESC", userId());
        return Api.ok(rows.stream().map(row -> product((UUID) row.get("productId"), false)).toList());
    }

    @POST @Path("/wishlist/{productId}")
    @RolesAllowed({"USER", "ADMIN"})
    public Map<String, Object> addWishlist(@PathParam("productId") UUID productId) {
        product(productId, false);
        Sql.update(database,
                "INSERT INTO wishlist_items(user_id,product_id) VALUES (?,?) ON CONFLICT DO NOTHING",
                userId(), productId);
        return Api.ok(Map.of());
    }

    @DELETE @Path("/wishlist/{productId}")
    @RolesAllowed({"USER", "ADMIN"})
    public Map<String, Object> removeWishlist(@PathParam("productId") UUID productId) {
        Sql.update(database, "DELETE FROM wishlist_items WHERE user_id=? AND product_id=?",
                userId(), productId);
        return Api.ok(Map.of());
    }

    @GET @Path("/admin/inventory")
    @RolesAllowed("ADMIN")
    public Map<String, Object> inventory() {
        return Api.ok(Sql.list(database,
                "SELECT v.id,v.product_id,p.name,v.sku,v.color,v.size,v.stock_quantity,v.reserved_quantity,"
                + "COALESCE(v.image_url,(SELECT i.url FROM product_images i WHERE i.product_id=p.id "
                + "ORDER BY i.is_primary DESC,i.sort_order LIMIT 1)) AS image_url "
                + "FROM product_variants v JOIN products p ON p.id=v.product_id ORDER BY p.name,v.sku"));
    }

    public record StockInput(Integer stockQuantity) {}

    @PATCH @Path("/admin/inventory/{variantId}")
    @RolesAllowed("ADMIN")
    public Map<String, Object> adjustStock(@PathParam("variantId") UUID variantId, StockInput input) {
        Api.require(input != null && input.stockQuantity() != null && input.stockQuantity() >= 0,
                400, "INVALID_INPUT", "Tồn kho không hợp lệ");
        try (Connection connection = database.getConnection()) {
            connection.setAutoCommit(false);
            Map<String, Object> current = Sql.one(connection,
                    "SELECT stock_quantity,reserved_quantity FROM product_variants WHERE id=? FOR UPDATE", variantId);
            Api.require(current != null, 404, "NOT_FOUND", "Không tìm thấy biến thể");
            int old = (int) current.get("stockQuantity");
            int reserved = (int) current.get("reservedQuantity");
            Api.require(input.stockQuantity() >= reserved, 409, "STOCK_RESERVED", "Tồn mới nhỏ hơn số lượng đang giữ");
            int delta = input.stockQuantity() - old;
            if (delta != 0) {
                Sql.update(connection, "UPDATE product_variants SET stock_quantity=?,updated_at=now() WHERE id=?",
                        input.stockQuantity(), variantId);
                Sql.update(connection,
                        "INSERT INTO inventory_movements(id,variant_id,delta,reason) VALUES (?,?,?,'ADMIN_ADJUST')",
                        UUID.randomUUID(), variantId, delta);
            }
            connection.commit();
            aiIndex.productChanged();
            return Api.ok(Sql.one(database,
                    "SELECT id,stock_quantity,reserved_quantity FROM product_variants WHERE id=?", variantId));
        } catch (SQLException error) {
            throw new IllegalStateException("Inventory adjustment failed", error);
        }
    }

    private Map<String, Object> search(boolean admin, String category, String query, Long minPrice,
            Long maxPrice, String size, String color, String sort, int page, int limit) {
        Api.require(page >= 1 && limit >= 1 && limit <= 100, 400, "INVALID_PAGE", "Phân trang không hợp lệ");
        StringBuilder where = new StringBuilder(admin ? " WHERE 1=1" : " WHERE p.status='ACTIVE'");
        if (!admin) where.append(" AND p.category_id IN (").append(VISIBLE_CATEGORY_IDS).append(")");
        List<Object> args = new ArrayList<>();
        if (category != null && !category.isBlank()) {
            where.append(" AND p.category_id IN (WITH RECURSIVE descendants AS ("
                    + "SELECT id FROM categories WHERE slug=? UNION "
                    + "SELECT child.id FROM categories child JOIN descendants d ON child.parent_id=d.id) "
                    + "SELECT id FROM descendants)");
            args.add(category);
        }
        if (query != null && !query.isBlank()) {
            where.append(" AND lower(p.name) LIKE ?"); args.add("%" + query.toLowerCase() + "%");
        }
        if (minPrice != null) {
            where.append(" AND (SELECT min(cp.effective_price) FROM product_variants v JOIN current_variant_prices cp ON cp.variant_id=v.id WHERE v.product_id=p.id AND v.is_active)>=?");
            args.add(minPrice);
        }
        if (maxPrice != null) {
            where.append(" AND (SELECT min(cp.effective_price) FROM product_variants v JOIN current_variant_prices cp ON cp.variant_id=v.id WHERE v.product_id=p.id AND v.is_active)<=?");
            args.add(maxPrice);
        }
        if (size != null && !size.isBlank()) {
            where.append(" AND EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id=p.id AND v.size=? AND v.is_active AND v.stock_quantity>v.reserved_quantity)");
            args.add(size);
        }
        if (color != null && !color.isBlank()) {
            where.append(" AND EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id=p.id AND lower(v.color)=lower(?) AND v.is_active AND v.stock_quantity>v.reserved_quantity)");
            args.add(color);
        }
        String base = " FROM products p JOIN categories c ON c.id=p.category_id" + where;
        long total = ((Number) Sql.one(database, "SELECT count(*) AS total" + base,
                args.toArray()).get("total")).longValue();
        String order = switch (sort == null ? "" : sort) {
            case "name_asc" -> "p.name ASC";
            case "newest" -> "p.created_at DESC";
            case "bestselling" -> SOLD_QUANTITY + " DESC,p.created_at DESC,p.id";
            case "price_asc" -> "(SELECT min(cp.effective_price) FROM product_variants v JOIN current_variant_prices cp ON cp.variant_id=v.id WHERE v.product_id=p.id AND v.is_active) ASC NULLS LAST";
            case "price_desc" -> "(SELECT min(cp.effective_price) FROM product_variants v JOIN current_variant_prices cp ON cp.variant_id=v.id WHERE v.product_id=p.id AND v.is_active) DESC NULLS LAST";
            default -> "p.created_at DESC";
        };
        List<Object> paged = new ArrayList<>(args);
        paged.add(limit); paged.add((page - 1) * limit);
        List<Map<String, Object>> ids = Sql.list(database,
                "SELECT p.id" + base + " ORDER BY " + order + " LIMIT ? OFFSET ?", paged.toArray());
        return Api.page(ids.stream().map(row -> product((UUID) row.get("id"), admin)).toList(),
                page, limit, total);
    }

    private Map<String, Object> product(UUID id, boolean admin) {
        Map<String, Object> row = Sql.one(database,
                "SELECT p.id,p.slug,p.name,p.description,p.category_id,p.brand,p.status,p.rating_average,p.review_count,"
                        + SOLD_QUANTITY + " AS sold_count,p.created_at,p.updated_at FROM products p WHERE p.id=?"
                        + (admin ? "" : " AND p.status='ACTIVE' AND p.category_id IN (" + VISIBLE_CATEGORY_IDS + ")"), id);
        Api.require(row != null, 404, "NOT_FOUND", "Không tìm thấy sản phẩm");
        List<Map<String, Object>> images = Sql.list(database,
                "SELECT id,url,alt,is_primary FROM product_images WHERE product_id=? ORDER BY is_primary DESC,sort_order", id);
        List<Map<String, Object>> variants = Sql.list(database,
                "SELECT v.id,v.sku,v.color,v.color_code,v.size,"
                + (admin ? "v.price" : "cp.effective_price") + " AS price,v.price AS base_price,"
                + "CASE WHEN cp.effective_price<v.price THEN v.price ELSE NULL END AS compare_at_price,"
                + "v.stock_quantity-v.reserved_quantity AS stock_quantity,v.image_url,v.is_active "
                + "FROM product_variants v JOIN current_variant_prices cp ON cp.variant_id=v.id "
                + "WHERE v.product_id=?" + (admin ? "" : " AND v.is_active=true") + " ORDER BY v.sku", id);
        List<Map<String, Object>> variantImages = Sql.list(database,
                "SELECT i.id,i.variant_id,i.url,i.alt,i.is_primary FROM variant_images i "
                + "JOIN product_variants v ON v.id=i.variant_id WHERE v.product_id=? "
                + "ORDER BY i.variant_id,i.is_primary DESC,i.sort_order", id);
        for (Map<String, Object> variant : variants) {
            UUID variantId = (UUID) variant.get("id");
            variant.put("images", variantImages.stream()
                    .filter(image -> variantId.equals(image.get("variantId")))
                    .map(image -> {
                        Map<String, Object> item = new HashMap<>(image);
                        item.remove("variantId");
                        return item;
                    }).toList());
        }
        Map<String, Object> promotion = Sql.one(database,
                "SELECT id,name,discount_type,discount_value,starts_at,ends_at FROM product_promotions "
                + "WHERE product_id=? AND is_enabled AND starts_at<=now() AND ends_at>now() "
                + "ORDER BY starts_at DESC LIMIT 1", id);
        row.put("images", images);
        row.put("variants", variants);
        row.put("minPrice", variants.stream().mapToLong(v -> ((Number) v.get("price")).longValue()).min().orElse(0));
        row.put("maxPrice", variants.stream().mapToLong(v -> ((Number) v.get("price")).longValue()).max().orElse(0));
        row.put("originalPrice", variants.stream()
                .min(Comparator.comparingLong(v -> ((Number) v.get("price")).longValue()))
                .map(v -> v.get("compareAtPrice")).orElse(null));
        row.put("promotion", promotion);
        return row;
    }

    private Map<String, Object> category(UUID id) {
        return Sql.one(database,
                "SELECT id,parent_id,name,slug,description,image_url,is_active FROM categories WHERE id=?", id);
    }

    private void saveProduct(UUID id, ProductInput input, boolean create) {
        Api.require(input != null && validText(input.name(), 250)
                && input.slug() != null && input.slug().matches("[a-z0-9]+(?:-[a-z0-9]+)*")
                && input.slug().length() <= 220 && input.categoryId() != null
                && categoryExists(input.categoryId()) && input.variants() != null
                && !input.variants().isEmpty() && input.variants().size() <= 100
                && input.images() != null && !input.images().isEmpty() && input.images().size() <= 12
                && input.images().stream().filter(image -> image != null && Boolean.TRUE.equals(image.isPrimary())).count() == 1
                && validText(input.description(), 10000)
                && (input.brand() == null || input.brand().length() <= 120),
                400, "INVALID_INPUT", "Sản phẩm hoặc biến thể không hợp lệ");
        Api.require(input.images().stream().allMatch(image -> image != null && validImageUrl(image.url())
                && (image.alt() == null || image.alt().length() <= 250)),
                400, "INVALID_IMAGE", "Ảnh sản phẩm không hợp lệ");
        Api.require(input.variants().stream().allMatch(variant -> variant != null
                && validText(variant.sku(), 80) && validText(variant.color(), 80)
                && validText(variant.size(), 40) && variant.price() != null && variant.price() >= 1000
                && variant.stockQuantity() != null && variant.stockQuantity() >= 0
                && (variant.colorCode() == null || variant.colorCode().length() <= 20)
                && (variant.imageUrl() == null || validImageUrl(variant.imageUrl()))
                && (variant.images() == null || (variant.images().size() <= 8
                    && (variant.images().isEmpty() || variant.images().stream()
                        .filter(image -> image != null && Boolean.TRUE.equals(image.isPrimary())).count() == 1)
                    && variant.images().stream().allMatch(image -> image != null
                        && validImageUrl(image.url())
                        && (image.alt() == null || image.alt().length() <= 250))))),
                400, "INVALID_VARIANT", "Biến thể không hợp lệ");
        Api.require(input.variants().stream().map(VariantInput::sku).distinct().count() == input.variants().size(),
                400, "DUPLICATE_SKU", "Mã hàng bị trùng trong sản phẩm");
        String status = input.status() == null ? "DRAFT" : input.status();
        Api.require(List.of("ACTIVE", "INACTIVE", "DRAFT").contains(status),
                400, "INVALID_STATUS", "Trạng thái sản phẩm không hợp lệ");
        try (Connection connection = database.getConnection()) {
            connection.setAutoCommit(false);
            if (!create) {
                Api.require(Sql.one(connection, "SELECT id FROM products WHERE id=? FOR UPDATE", id) != null,
                        404, "NOT_FOUND", "Không tìm thấy sản phẩm");
                List<Map<String, Object>> scheduled = Sql.list(connection,
                        "SELECT discount_type,discount_value FROM product_promotions "
                        + "WHERE product_id=? AND is_enabled AND ends_at>now()", id);
                if (!scheduled.isEmpty()) {
                    long minimum = input.variants().stream()
                            .filter(variant -> variant.isActive() == null || variant.isActive())
                            .mapToLong(VariantInput::price).min().orElse(Long.MAX_VALUE);
                    for (Map<String, Object> promotion : scheduled) {
                        long value = ((Number) promotion.get("discountValue")).longValue();
                        long finalPrice = "PERCENT".equals(promotion.get("discountType"))
                                ? (long) Math.floor(minimum * (100 - value) / 100.0)
                                : minimum - value;
                        Api.require(finalPrice >= 1000,
                                409, "PROMOTION_PRICE_CONFLICT",
                                "Giá biến thể quá thấp so với chương trình giảm giá đã đặt");
                    }
                }
            }
            if (create) {
                Sql.update(connection,
                        "INSERT INTO products(id,category_id,slug,name,description,brand,status) VALUES (?,?,?,?,?,?,?)",
                        id, input.categoryId(), input.slug(), input.name(), input.description() == null ? "" : input.description(),
                        input.brand(), status);
            } else {
                Api.require(Sql.update(connection,
                        "UPDATE products SET category_id=?,slug=?,name=?,description=?,brand=?,status=?,updated_at=now() WHERE id=?",
                        input.categoryId(), input.slug(), input.name(), input.description() == null ? "" : input.description(),
                        input.brand(), status, id) == 1,
                        404, "NOT_FOUND", "Không tìm thấy sản phẩm");
                Sql.update(connection, "DELETE FROM product_images WHERE product_id=?", id);
            }
            if (input.images() != null) {
                int position = 0;
                for (ImageInput image : input.images()) {
                    Api.require(text(image.url()), 400, "INVALID_IMAGE", "Ảnh không hợp lệ");
                    Sql.update(connection,
                            "INSERT INTO product_images(id,product_id,url,alt,is_primary,sort_order) VALUES (?,?,?,?,?,?)",
                            UUID.randomUUID(), id, image.url(), image.alt() == null ? "" : image.alt(),
                            Boolean.TRUE.equals(image.isPrimary()), position++);
                }
            }
            for (VariantInput variant : input.variants()) {
                Api.require(text(variant.sku()) && text(variant.color()) && text(variant.size())
                        && variant.price() != null && variant.price() >= 0
                        && variant.stockQuantity() != null && variant.stockQuantity() >= 0,
                        400, "INVALID_VARIANT", "Biến thể không hợp lệ");
                UUID variantId = variant.id() == null ? UUID.randomUUID() : variant.id();
                List<VariantImageInput> assignedImages = variant.images() == null && variant.imageUrl() != null
                        ? List.of(new VariantImageInput(variant.imageUrl(), "", true))
                        : variant.images() == null ? List.of() : variant.images();
                String primaryImage = assignedImages.stream().filter(image -> Boolean.TRUE.equals(image.isPrimary()))
                        .map(VariantImageInput::url).findFirst().orElse(null);
                if (variant.id() != null && !create && Sql.one(connection,
                        "SELECT id FROM product_variants WHERE id=? AND product_id=?", variant.id(), id) != null) {
                    Api.require(Sql.update(connection,
                            "UPDATE product_variants SET sku=?,color=?,color_code=?,size=?,price=?,stock_quantity=?,image_url=?,is_active=?,updated_at=now() WHERE id=? AND product_id=? AND reserved_quantity<=?",
                            variant.sku(), variant.color(), variant.colorCode(), variant.size(),
                            variant.price(), variant.stockQuantity(), primaryImage,
                            variant.isActive() == null || variant.isActive(), variant.id(), id,
                            variant.stockQuantity()) == 1, 409, "VARIANT_CONFLICT", "Biến thể không tồn tại hoặc đang giữ tồn");
                    Sql.update(connection, "DELETE FROM variant_images WHERE variant_id=?", variantId);
                } else {
                    Sql.update(connection,
                            "INSERT INTO product_variants(id,product_id,sku,color,color_code,size,price,stock_quantity,image_url,is_active) VALUES (?,?,?,?,?,?,?,?,?,?)",
                            variantId, id, variant.sku(), variant.color(), variant.colorCode(),
                            variant.size(), variant.price(), variant.stockQuantity(), primaryImage,
                            variant.isActive() == null || variant.isActive());
                }
                int position = 0;
                for (VariantImageInput image : assignedImages) {
                    Sql.update(connection,
                            "INSERT INTO variant_images(id,variant_id,url,alt,is_primary,sort_order) VALUES (?,?,?,?,?,?)",
                            UUID.randomUUID(), variantId, image.url(), image.alt() == null ? "" : image.alt(),
                            Boolean.TRUE.equals(image.isPrimary()), position++);
                }
            }
            connection.commit();
        } catch (SQLException error) {
            throw new IllegalStateException("Product update failed", error);
        }
    }

    private UUID userId() { return UUID.fromString(jwt.getSubject()); }
    private boolean text(String value) { return value != null && !value.isBlank(); }
    private boolean validText(String value, int max) { return text(value) && value.trim().length() <= max; }
    private boolean validImageUrl(String value) {
        return value != null && value.length() <= 2048
                && (value.startsWith("/api/v1/media/") || value.matches("https?://[^\\s]+"));
    }
    private boolean categoryExists(UUID id) {
        return Sql.one(database, "SELECT id FROM categories WHERE id=?", id) != null;
    }
    private void validateParent(UUID id, UUID parentId) {
        if (parentId == null) return;
        Api.require(categoryExists(parentId), 400, "PARENT_NOT_FOUND", "Danh mục cha không tồn tại");
        Api.require(!parentId.equals(id), 400, "CATEGORY_CYCLE", "Danh mục không thể là cha của chính nó");
        if (id != null) {
            Api.require(Sql.one(database,
                    "WITH RECURSIVE descendants AS (SELECT id FROM categories WHERE parent_id=? "
                    + "UNION SELECT c.id FROM categories c JOIN descendants d ON c.parent_id=d.id) "
                    + "SELECT id FROM descendants WHERE id=? LIMIT 1", id, parentId) == null,
                    400, "CATEGORY_CYCLE", "Không thể chuyển danh mục vào một danh mục con của nó");
        }
    }
    private void validateCategory(CategoryInput input) {
        Api.require(input != null && validText(input.name(), 150)
                && input.slug() != null && input.slug().length() <= 180
                && input.slug().matches("[a-z0-9]+(?:-[a-z0-9]+)*")
                && (input.description() == null || input.description().length() <= 5000)
                && (input.imageUrl() == null || validImageUrl(input.imageUrl())),
                400, "INVALID_INPUT", "Danh mục không hợp lệ");
    }
}
