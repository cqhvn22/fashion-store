package com.fashion.catalog;

import com.fashion.common.Api;
import com.fashion.common.Sql;
import jakarta.annotation.security.RolesAllowed;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import javax.sql.DataSource;
import org.eclipse.microprofile.jwt.JsonWebToken;

@Path("/api/v1/reviews")
@Consumes(MediaType.APPLICATION_JSON)
@Produces(MediaType.APPLICATION_JSON)
public class ReviewResource {
    @Inject DataSource database;
    @Inject JsonWebToken jwt;
    @Inject OrderReviewClient orders;

    public record ReviewInput(UUID orderItemId, Integer rating, String content, List<String> imageUrls) {}
    public record VisibilityInput(Boolean visible) {}
    public record ReplyInput(String content) {}

    @GET @Path("/product/{productId}")
    public Map<String, Object> productReviews(@PathParam("productId") UUID productId,
            @QueryParam("rating") Integer rating, @DefaultValue("false") @QueryParam("withImages") boolean withImages,
            @DefaultValue("1") @QueryParam("page") int page,
            @DefaultValue("10") @QueryParam("limit") int limit) {
        Api.require(page >= 1 && limit >= 1 && limit <= 50 && (rating == null || rating >= 1 && rating <= 5),
                400, "INVALID_FILTER", "Bộ lọc đánh giá không hợp lệ");
        Api.require(Sql.one(database, "SELECT id FROM products WHERE id=? AND status='ACTIVE'", productId) != null,
                404, "PRODUCT_NOT_FOUND", "Không tìm thấy sản phẩm");
        String filter = " WHERE r.product_id=? AND r.status='VISIBLE'"
                + (rating == null ? "" : " AND r.rating=?")
                + (withImages ? " AND EXISTS (SELECT 1 FROM review_images i WHERE i.review_id=r.id)" : "");
        List<Object> args = new ArrayList<>();
        args.add(productId);
        if (rating != null) args.add(rating);
        long total = ((Number) Sql.one(database,
                "SELECT count(*) AS total FROM product_reviews r" + filter,
                args.toArray()).get("total")).longValue();
        args.add(limit); args.add((page - 1) * limit);
        List<Map<String, Object>> rows = Sql.list(database,
                "SELECT r.* FROM product_reviews r" + filter + " ORDER BY r.created_at DESC LIMIT ? OFFSET ?",
                args.toArray());
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("content", rows.stream().map(row -> present(row, false)).toList());
        result.put("page", page);
        result.put("size", limit);
        result.put("totalElements", total);
        result.put("totalPages", (total + limit - 1) / limit);
        result.put("last", (long) page * limit >= total);
        List<Map<String, Object>> counts = Sql.list(database,
                "SELECT rating,count(*) AS total FROM product_reviews "
                + "WHERE product_id=? AND status='VISIBLE' GROUP BY rating", productId);
        Map<Integer, Long> summary = new LinkedHashMap<>();
        for (int star = 5; star >= 1; star--) summary.put(star, 0L);
        for (Map<String, Object> count : counts)
            summary.put(((Number) count.get("rating")).intValue(), ((Number) count.get("total")).longValue());
        result.put("starCounts", summary);
        return Api.ok(result);
    }

    @GET @Path("/my")
    @RolesAllowed({"USER", "ADMIN"})
    public Map<String, Object> mine(@QueryParam("orderId") UUID orderId) {
        Api.require(orderId != null, 400, "ORDER_REQUIRED", "Thiếu mã đơn hàng");
        return Api.ok(Sql.list(database,
                "SELECT * FROM product_reviews WHERE user_id=? AND order_id=? ORDER BY created_at DESC",
                userId(), orderId).stream().map(row -> present(row, true)).toList());
    }

    @GET @Path("/eligibility/{orderItemId}")
    @RolesAllowed({"USER", "ADMIN"})
    public Map<String, Object> eligibility(@PathParam("orderItemId") UUID orderItemId) {
        OrderReviewClient.Eligibility eligibility = orders.check(orderItemId, userId());
        Map<String, Object> existing = Sql.one(database,
                "SELECT * FROM product_reviews WHERE order_item_id=? AND user_id=?", orderItemId, userId());
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("eligible", eligibility.eligible() && existing == null);
        result.put("deadline", eligibility.deadline());
        result.put("orderId", eligibility.orderId());
        result.put("productId", eligibility.productId());
        result.put("review", existing == null ? null : present(existing, true));
        return Api.ok(result);
    }

    @POST
    @RolesAllowed({"USER", "ADMIN"})
    public Map<String, Object> create(ReviewInput input) {
        validate(input, true);
        OrderReviewClient.Eligibility purchase = orders.check(input.orderItemId(), userId());
        Api.require(purchase.eligible(), 409, "NOT_ELIGIBLE",
                "Chỉ được đánh giá sản phẩm trong 30 ngày sau khi đơn đã giao");
        UUID id = UUID.randomUUID();
        try (Connection connection = database.getConnection()) {
            connection.setAutoCommit(false);
            lockProduct(connection, purchase.productId());
            Api.require(Sql.one(connection,
                    "SELECT id FROM product_reviews WHERE order_item_id=?", input.orderItemId()) == null,
                    409, "ALREADY_REVIEWED", "Sản phẩm này đã được đánh giá trong đơn hàng");
            Sql.update(connection,
                    "INSERT INTO product_reviews(id,order_id,order_item_id,user_id,product_id,variant_id,size,color,rating,content) "
                    + "VALUES (?,?,?,?,?,?,?,?,?,?)",
                    id, purchase.orderId(), purchase.orderItemId(), userId(), purchase.productId(),
                    purchase.variantId(), purchase.size(), purchase.color(), input.rating(), input.content().trim());
            saveImages(connection, id, input.imageUrls());
            updateSummary(connection, purchase.productId());
            connection.commit();
        } catch (SQLException error) {
            throw new IllegalStateException("Review creation failed", error);
        }
        return Api.ok(present(find(id), true));
    }

    @PUT @Path("/{id}")
    @RolesAllowed({"USER", "ADMIN"})
    public Map<String, Object> edit(@PathParam("id") UUID id, ReviewInput input) {
        validate(input, false);
        try (Connection connection = database.getConnection()) {
            connection.setAutoCommit(false);
            Map<String, Object> current = Sql.one(connection,
                    "SELECT * FROM product_reviews WHERE id=? AND user_id=?", id, userId());
            Api.require(current != null, 404, "NOT_FOUND", "Không tìm thấy đánh giá của bạn");
            UUID productId = (UUID) current.get("productId");
            lockProduct(connection, productId);
            current = Sql.one(connection, "SELECT * FROM product_reviews WHERE id=? FOR UPDATE", id);
            Api.require("VISIBLE".equals(current.get("status"))
                    && ((Number) current.get("editCount")).intValue() == 0
                    && !Instant.now().isAfter(((Timestamp) current.get("createdAt")).toInstant()
                        .plusSeconds(30L * 24 * 60 * 60)),
                    409, "EDIT_LIMIT", "Đánh giá chỉ được sửa một lần trong 30 ngày từ khi đăng");
            Sql.update(connection,
                    "UPDATE product_reviews SET rating=?,content=?,edit_count=1,updated_at=now() WHERE id=?",
                    input.rating(), input.content().trim(), id);
            Sql.update(connection, "DELETE FROM review_images WHERE review_id=?", id);
            saveImages(connection, id, input.imageUrls());
            updateSummary(connection, productId);
            connection.commit();
        } catch (SQLException error) {
            throw new IllegalStateException("Review update failed", error);
        }
        return Api.ok(present(find(id), true));
    }

    @GET @Path("/admin")
    @RolesAllowed("ADMIN")
    public Map<String, Object> adminReviews(@DefaultValue("1") @QueryParam("page") int page) {
        Api.require(page >= 1, 400, "INVALID_PAGE", "Trang không hợp lệ");
        List<Map<String, Object>> rows = Sql.list(database,
                "SELECT r.*,p.name AS product_name FROM product_reviews r "
                + "JOIN products p ON p.id=r.product_id ORDER BY r.created_at DESC LIMIT 50 OFFSET ?",
                (page - 1) * 50);
        long total = ((Number) Sql.one(database,
                "SELECT count(*) AS total FROM product_reviews").get("total")).longValue();
        return Api.page(rows.stream().map(row -> present(row, true)).toList(), page, 50, total);
    }

    @PATCH @Path("/admin/{id}/visibility")
    @RolesAllowed("ADMIN")
    public Map<String, Object> visibility(@PathParam("id") UUID id, VisibilityInput input) {
        Api.require(input != null && input.visible() != null, 400, "INVALID_INPUT", "Chọn trạng thái hiển thị");
        try (Connection connection = database.getConnection()) {
            connection.setAutoCommit(false);
            Map<String, Object> current = Sql.one(connection,
                    "SELECT product_id FROM product_reviews WHERE id=?", id);
            Api.require(current != null, 404, "NOT_FOUND", "Không tìm thấy đánh giá");
            UUID productId = (UUID) current.get("productId");
            lockProduct(connection, productId);
            Sql.update(connection, "UPDATE product_reviews SET status=?,updated_at=now() WHERE id=?",
                    input.visible() ? "VISIBLE" : "HIDDEN", id);
            updateSummary(connection, productId);
            connection.commit();
        } catch (SQLException error) {
            throw new IllegalStateException("Review visibility update failed", error);
        }
        return Api.ok(present(find(id), true));
    }

    @PUT @Path("/admin/{id}/reply")
    @RolesAllowed("ADMIN")
    public Map<String, Object> reply(@PathParam("id") UUID id, ReplyInput input) {
        Api.require(input != null && input.content() != null
                && input.content().trim().length() >= 2 && input.content().trim().length() <= 1000,
                400, "INVALID_REPLY", "Phản hồi cần từ 2 đến 1.000 ký tự");
        Api.require(Sql.update(database,
                "UPDATE product_reviews SET seller_reply=?,replied_at=now(),updated_at=now() WHERE id=?",
                input.content().trim(), id) == 1,
                404, "NOT_FOUND", "Không tìm thấy đánh giá");
        return Api.ok(present(find(id), true));
    }

    private void validate(ReviewInput input, boolean create) {
        Api.require(input != null && (!create || input.orderItemId() != null)
                && input.rating() != null && input.rating() >= 1 && input.rating() <= 5
                && input.content() != null && input.content().trim().length() >= 10
                && input.content().trim().length() <= 2000
                && (input.imageUrls() == null || input.imageUrls().size() <= 5),
                400, "INVALID_REVIEW", "Chọn 1–5 sao và viết nhận xét từ 10 đến 2.000 ký tự");
        List<String> images = input.imageUrls() == null ? List.of() : input.imageUrls();
        Api.require(images.stream().allMatch(url -> url != null
                && url.matches("/api/v1/media/[0-9a-f-]{36}\\.(jpg|png|webp)"))
                && images.stream().distinct().count() == images.size(),
                400, "INVALID_REVIEW_IMAGES", "Ảnh đánh giá không hợp lệ");
    }

    private void saveImages(Connection connection, UUID id, List<String> imageUrls) throws SQLException {
        if (imageUrls == null) return;
        int index = 0;
        for (String url : imageUrls)
            Sql.update(connection, "INSERT INTO review_images(id,review_id,url,sort_order) VALUES (?,?,?,?)",
                    UUID.randomUUID(), id, url, index++);
    }

    private void lockProduct(Connection connection, UUID productId) throws SQLException {
        Api.require(Sql.one(connection, "SELECT id FROM products WHERE id=? FOR UPDATE", productId) != null,
                404, "PRODUCT_NOT_FOUND", "Sản phẩm không còn tồn tại");
    }

    private void updateSummary(Connection connection, UUID productId) throws SQLException {
        Sql.update(connection,
                "UPDATE products SET rating_average=COALESCE((SELECT round(avg(rating)::numeric,2) "
                + "FROM product_reviews WHERE product_id=? AND status='VISIBLE'),0),"
                + "review_count=(SELECT count(*) FROM product_reviews WHERE product_id=? AND status='VISIBLE'),"
                + "updated_at=now() WHERE id=?", productId, productId, productId);
    }

    private Map<String, Object> find(UUID id) {
        return Sql.one(database, "SELECT * FROM product_reviews WHERE id=?", id);
    }

    private Map<String, Object> present(Map<String, Object> row, boolean ownerOrAdmin) {
        UUID id = (UUID) row.get("id");
        UUID userId = (UUID) row.get("userId");
        Map<String, Object> result = new LinkedHashMap<>();
        for (String field : List.of("id", "productId", "variantId", "size", "color", "rating",
                "content", "sellerReply", "repliedAt", "createdAt", "updatedAt"))
            result.put(field, row.get(field));
        result.put("verifiedPurchase", true);
        result.put("reviewerName", "Khách mua hàng " + userId.toString().substring(0, 4).toUpperCase());
        result.put("images", Sql.list(database,
                "SELECT url FROM review_images WHERE review_id=? ORDER BY sort_order", id)
                .stream().map(image -> image.get("url")).toList());
        if (ownerOrAdmin) {
            result.put("orderId", row.get("orderId"));
            result.put("orderItemId", row.get("orderItemId"));
            result.put("productName", row.get("productName"));
            result.put("status", row.get("status"));
            result.put("editCount", row.get("editCount"));
            result.put("canEdit", "VISIBLE".equals(row.get("status"))
                    && ((Number) row.get("editCount")).intValue() == 0
                    && !Instant.now().isAfter(((Timestamp) row.get("createdAt")).toInstant()
                        .plusSeconds(30L * 24 * 60 * 60)));
        }
        return result;
    }

    private UUID userId() { return UUID.fromString(jwt.getSubject()); }
}
