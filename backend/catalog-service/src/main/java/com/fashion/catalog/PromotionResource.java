package com.fashion.catalog;

import com.fashion.common.Api;
import com.fashion.common.Sql;
import jakarta.annotation.security.RolesAllowed;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import java.sql.Array;
import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;
import javax.sql.DataSource;

@Path("/api/v1/admin/promotions")
@Consumes(MediaType.APPLICATION_JSON)
@Produces(MediaType.APPLICATION_JSON)
@RolesAllowed("ADMIN")
public class PromotionResource {
    @Inject DataSource database;
    @Inject AiIndexNotifier aiIndex;

    public record PromotionInput(
            UUID productId,
            List<UUID> productIds,
            String targetType,
            List<UUID> categoryIds,
            List<UUID> excludedProductIds,
            String name,
            String discountType,
            Long discountValue,
            Instant startsAt,
            Instant endsAt,
            Boolean isEnabled
    ) {}

    @GET
    public Map<String, Object> list() {
        return Api.ok(Sql.list(database,
                "SELECT (min(p.id::text))::uuid AS id, "
                + "CASE WHEN count(DISTINCT p.product_id) = 1 THEN (min(p.product_id::text))::uuid ELSE NULL END AS product_id, "
                + "CASE WHEN count(DISTINCT p.product_id) = 1 THEN min(product.name) ELSE NULL END AS product_name, "
                + "p.name, p.discount_type, p.discount_value, p.starts_at, p.ends_at, p.is_enabled, "
                + "min(p.created_at) AS created_at, max(p.updated_at) AS updated_at, "
                + "CASE WHEN NOT p.is_enabled THEN 'DISABLED' "
                + "WHEN p.starts_at>now() THEN 'SCHEDULED' "
                + "WHEN p.ends_at<=now() THEN 'ENDED' ELSE 'ACTIVE' END AS state, "
                + "CASE WHEN count(DISTINCT p.product_id) = 1 THEN 'PRODUCT' "
                + "     WHEN count(DISTINCT p.product_id) >= (SELECT count(*) FROM products WHERE status='ACTIVE') THEN 'ALL' "
                + "     ELSE 'CATEGORY' END AS target_type, "
                + "count(DISTINCT p.product_id) AS applied_count "
                + "FROM product_promotions p JOIN products product ON product.id=p.product_id "
                + "GROUP BY p.name, p.discount_type, p.discount_value, p.starts_at, p.ends_at, p.is_enabled "
                + "ORDER BY min(p.created_at) DESC"));
    }

    @POST
    public Map<String, Object> create(PromotionInput input) {
        validate(input);
        try (Connection connection = database.getConnection()) {
            connection.setAutoCommit(false);
            List<UUID> targetIds = resolveTargetProductIds(connection, input);
            Api.require(!targetIds.isEmpty(), 400, "NO_TARGET_PRODUCTS", "Không tìm thấy sản phẩm áp dụng nào");

            UUID firstId = null;
            int count = 0;
            for (UUID pId : targetIds) {
                if (targetIds.size() == 1) {
                    lockAndCheck(connection, UUID.randomUUID(), pId, input);
                } else if (Boolean.TRUE.equals(input.isEnabled())) {
                    // Disable overlapping promotions to avoid conflict
                    Sql.update(connection,
                            "UPDATE product_promotions SET is_enabled=false, updated_at=now() "
                            + "WHERE product_id=? AND is_enabled AND starts_at<? AND ends_at>?",
                            pId, Timestamp.from(input.endsAt()), Timestamp.from(input.startsAt()));
                }

                UUID id = UUID.randomUUID();
                if (firstId == null) firstId = id;
                Sql.update(connection,
                        "INSERT INTO product_promotions(id,product_id,name,discount_type,discount_value,starts_at,ends_at,is_enabled) "
                        + "VALUES (?,?,?,?,?,?,?,?)",
                        id, pId, input.name().trim(), input.discountType(), input.discountValue(),
                        Timestamp.from(input.startsAt()), Timestamp.from(input.endsAt()), Boolean.TRUE.equals(input.isEnabled()));
                count++;
            }
            connection.commit();
            aiIndex.productChanged();
            Map<String, Object> res = firstId != null ? find(firstId) : new HashMap<>();
            if (res != null) {
                res.put("appliedCount", count);
            }
            return Api.ok(res);
        } catch (SQLException error) {
            throw new IllegalStateException("Promotion creation failed", error);
        }
    }

    @PUT @Path("/{id}")
    public Map<String, Object> update(@PathParam("id") UUID id, PromotionInput input) {
        validate(input);
        try (Connection connection = database.getConnection()) {
            connection.setAutoCommit(false);
            Map<String, Object> current = Sql.one(connection,
                    "SELECT id, product_id, name, discount_type, discount_value, starts_at, ends_at FROM product_promotions WHERE id=?", id);
            Api.require(current != null, 404, "NOT_FOUND", "Không tìm thấy chương trình giảm giá");

            String oldName = (String) current.get("name");
            String oldType = (String) current.get("discountType");
            Number oldValue = (Number) current.get("discountValue");

            List<Map<String, Object>> group = Sql.list(connection,
                    "SELECT id, product_id FROM product_promotions WHERE name=? AND discount_type=? AND discount_value=?",
                    oldName, oldType, oldValue.longValue());

            if (group.size() <= 1 && input.productId() != null) {
                UUID pId = input.productId();
                Api.require(pId.equals(current.get("productId")), 400,
                        "PRODUCT_IMMUTABLE", "Không thể đổi sản phẩm của chương trình đã tạo");
                lockAndCheck(connection, id, pId, input);
                Sql.update(connection,
                        "UPDATE product_promotions SET name=?,discount_type=?,discount_value=?,starts_at=?,ends_at=?,"
                        + "is_enabled=?,updated_at=now() WHERE id=?",
                        input.name().trim(), input.discountType(), input.discountValue(),
                        Timestamp.from(input.startsAt()), Timestamp.from(input.endsAt()), Boolean.TRUE.equals(input.isEnabled()), id);
            } else {
                for (Map<String, Object> item : group) {
                    UUID rowId = (UUID) item.get("id");
                    Sql.update(connection,
                            "UPDATE product_promotions SET name=?,discount_type=?,discount_value=?,starts_at=?,ends_at=?,"
                            + "is_enabled=?,updated_at=now() WHERE id=?",
                            input.name().trim(), input.discountType(), input.discountValue(),
                            Timestamp.from(input.startsAt()), Timestamp.from(input.endsAt()), Boolean.TRUE.equals(input.isEnabled()), rowId);
                }
            }

            connection.commit();
        } catch (SQLException error) {
            throw new IllegalStateException("Promotion update failed", error);
        }
        aiIndex.productChanged();
        return Api.ok(find(id));
    }

    @DELETE @Path("/{id}")
    public Map<String, Object> delete(@PathParam("id") UUID id) {
        try (Connection connection = database.getConnection()) {
            connection.setAutoCommit(false);
            Map<String, Object> current = Sql.one(connection,
                    "SELECT name, discount_type, discount_value FROM product_promotions WHERE id=?", id);
            if (current != null) {
                Sql.update(connection,
                        "DELETE FROM product_promotions WHERE name=? AND discount_type=? AND discount_value=?",
                        current.get("name"), current.get("discountType"), ((Number) current.get("discountValue")).longValue());
            } else {
                Sql.update(connection, "DELETE FROM product_promotions WHERE id=?", id);
            }
            connection.commit();
        } catch (SQLException error) {
            throw new IllegalStateException("Promotion deletion failed", error);
        }
        aiIndex.productChanged();
        return Api.ok(Map.of());
    }

    private List<UUID> resolveTargetProductIds(Connection connection, PromotionInput input) throws SQLException {
        if (input.productId() != null) {
            return List.of(input.productId());
        }
        Set<UUID> excluded = input.excludedProductIds() != null ? new HashSet<>(input.excludedProductIds()) : Set.of();
        if (input.productIds() != null && !input.productIds().isEmpty()) {
            return input.productIds().stream().filter(id -> !excluded.contains(id)).toList();
        }
        if ("CATEGORY".equalsIgnoreCase(input.targetType()) && input.categoryIds() != null && !input.categoryIds().isEmpty()) {
            String sql = "SELECT p.id FROM products p WHERE p.status='ACTIVE' AND p.category_id IN ("
                    + "WITH RECURSIVE cat_tree AS ("
                    + "  SELECT id FROM categories WHERE id = ANY(?) "
                    + "  UNION "
                    + "  SELECT c.id FROM categories c JOIN cat_tree ct ON c.parent_id = ct.id"
                    + ") SELECT id FROM cat_tree)";
            Array catArray = connection.createArrayOf("uuid", input.categoryIds().toArray());
            List<Map<String, Object>> rows = Sql.list(connection, sql, catArray);
            return rows.stream().map(r -> (UUID) r.get("id")).filter(id -> !excluded.contains(id)).toList();
        }
        if ("ALL".equalsIgnoreCase(input.targetType()) || input.targetType() == null) {
            List<Map<String, Object>> rows = Sql.list(connection, "SELECT id FROM products WHERE status='ACTIVE'");
            return rows.stream().map(r -> (UUID) r.get("id")).filter(id -> !excluded.contains(id)).toList();
        }
        return List.of();
    }

    private Map<String, Object> find(UUID id) {
        return Sql.one(database,
                "SELECT p.id,p.product_id,product.name AS product_name,p.name,p.discount_type,"
                + "p.discount_value,p.starts_at,p.ends_at,p.is_enabled,p.created_at,p.updated_at "
                + "FROM product_promotions p JOIN products product ON product.id=p.product_id WHERE p.id=?", id);
    }

    private void validate(PromotionInput input) {
        boolean hasTarget = input != null && (
                input.productId() != null
                || (input.productIds() != null && !input.productIds().isEmpty())
                || "ALL".equalsIgnoreCase(input.targetType())
                || ("CATEGORY".equalsIgnoreCase(input.targetType()) && input.categoryIds() != null && !input.categoryIds().isEmpty())
                || input.targetType() == null
        );
        Api.require(input != null && hasTarget && input.name() != null
                && !input.name().isBlank() && input.name().trim().length() <= 150
                && input.discountType() != null && List.of("PERCENT", "FIXED").contains(input.discountType())
                && input.discountValue() != null && input.discountValue() > 0
                && ("FIXED".equals(input.discountType()) || input.discountValue() <= 99)
                && input.startsAt() != null && input.endsAt() != null
                && input.startsAt().isBefore(input.endsAt()) && input.isEnabled() != null,
                400, "INVALID_PROMOTION", "Kiểm tra tên, mức giảm và thời gian áp dụng");
    }

    private void lockAndCheck(Connection connection, UUID id, UUID productId, PromotionInput input) throws SQLException {
        // Khóa sản phẩm để các thao tác tạo/sửa chương trình cho cùng sản phẩm không chồng lịch.
        Map<String, Object> product = Sql.one(connection,
                "SELECT id FROM products WHERE id=? FOR UPDATE", productId);
        Api.require(product != null, 404, "PRODUCT_NOT_FOUND", "Không tìm thấy sản phẩm");
        if (!Boolean.TRUE.equals(input.isEnabled())) return;
        Api.require(input.endsAt().isAfter(Instant.now()), 400,
                "PROMOTION_ENDED", "Thời gian kết thúc phải ở tương lai");
        Map<String, Object> overlap = Sql.one(connection,
                "SELECT id FROM product_promotions WHERE product_id=? AND id<>? AND is_enabled "
                + "AND starts_at<? AND ends_at>? LIMIT 1",
                productId, id, Timestamp.from(input.endsAt()), Timestamp.from(input.startsAt()));
        Api.require(overlap == null, 409, "PROMOTION_OVERLAP",
                "Sản phẩm đã có chương trình giảm giá trong khoảng thời gian này");
        Map<String, Object> price = Sql.one(connection,
                "SELECT min(price) AS minimum FROM product_variants WHERE product_id=? AND is_active",
                productId);
        Api.require(price != null && price.get("minimum") != null,
                400, "NO_ACTIVE_VARIANT", "Sản phẩm cần có biến thể đang bán");
        long minimum = ((Number) price.get("minimum")).longValue();
        long finalPrice = "PERCENT".equals(input.discountType())
                ? (long) Math.floor(minimum * (100 - input.discountValue()) / 100.0)
                : minimum - input.discountValue();
        Api.require(finalPrice >= 1000, 400, "INVALID_DISCOUNT",
                "Mức giảm làm giá một biến thể thấp hơn 1.000 VND");
    }
}
