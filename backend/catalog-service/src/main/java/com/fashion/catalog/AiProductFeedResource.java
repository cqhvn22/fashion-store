package com.fashion.catalog;

import com.fashion.common.Api;
import com.fashion.common.Sql;
import jakarta.inject.Inject;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.HeaderParam;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import javax.sql.DataSource;
import org.eclipse.microprofile.config.inject.ConfigProperty;

@Path("/api/v1/internal/ai-products")
@Produces(MediaType.APPLICATION_JSON)
public class AiProductFeedResource {
    private static final String VISIBLE_CATEGORIES = "WITH RECURSIVE visible_categories AS ("
            + "SELECT id FROM categories WHERE parent_id IS NULL AND is_active "
            + "UNION ALL SELECT c.id FROM categories c JOIN visible_categories v ON v.id=c.parent_id "
            + "WHERE c.is_active) ";
    @Inject DataSource database;
    @ConfigProperty(name = "internal.api.key") String internalKey;

    @GET
    public Map<String, Object> list(@HeaderParam("X-Internal-Key") String provided,
            @DefaultValue("1") @QueryParam("page") int page,
            @DefaultValue("100") @QueryParam("limit") int limit) {
        Api.require(provided != null && MessageDigest.isEqual(
                provided.getBytes(StandardCharsets.UTF_8), internalKey.getBytes(StandardCharsets.UTF_8)),
                403, "FORBIDDEN", "Không có quyền truy cập");
        Api.require(page >= 1 && limit >= 1 && limit <= 100, 400, "INVALID_PAGE", "Trang không hợp lệ");
        long total = ((Number) Sql.one(database, VISIBLE_CATEGORIES
                + "SELECT count(*) AS total FROM products p WHERE p.status='ACTIVE' "
                + "AND p.category_id IN (SELECT id FROM visible_categories)").get("total")).longValue();
        List<Map<String, Object>> rows = Sql.list(database, VISIBLE_CATEGORIES
                + "SELECT p.id,p.slug,p.name,p.description,c.name AS category,p.original_price "
                + "FROM products p JOIN categories c ON c.id=p.category_id "
                + "WHERE p.status='ACTIVE' AND p.category_id IN (SELECT id FROM visible_categories) "
                + "ORDER BY p.id LIMIT ? OFFSET ?", limit, (page - 1) * limit);
        List<Map<String, Object>> products = rows.stream().map(this::detail).toList();
        return Api.page(products, page, limit, total);
    }

    private Map<String, Object> detail(Map<String, Object> row) {
        UUID productId = (UUID) row.get("id");
        List<Map<String, Object>> variants = Sql.list(database,
                "SELECT v.color,v.size,v.stock_quantity-v.reserved_quantity AS available,"
                + "cp.effective_price AS price FROM product_variants v "
                + "JOIN current_variant_prices cp ON cp.variant_id=v.id "
                + "WHERE v.product_id=? AND v.is_active ORDER BY v.sku", productId);
        Map<String, Object> result = new LinkedHashMap<>(row);
        result.put("price", variants.stream().mapToLong(v -> ((Number) v.get("price")).longValue())
                .min().orElse(0));
        result.put("colors", variants.stream().map(v -> (String) v.get("color")).distinct().toList());
        result.put("sizes", variants.stream().map(v -> (String) v.get("size")).distinct().toList());
        result.put("inStock", variants.stream().anyMatch(v -> ((Number) v.get("available")).longValue() > 0));
        Map<String, Object> image = Sql.one(database,
                "SELECT url FROM product_images WHERE product_id=? ORDER BY is_primary DESC,sort_order LIMIT 1",
                productId);
        result.put("imageUrl", image == null ? null : image.get("url"));
        return result;
    }
}
