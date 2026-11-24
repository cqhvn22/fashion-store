package com.fashion.order;

import com.fashion.common.Api;
import com.fashion.common.Sql;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.HeaderParam;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import javax.sql.DataSource;
import org.eclipse.microprofile.config.inject.ConfigProperty;

@Path("/api/v1/internal/review-eligibility")
@Produces(MediaType.APPLICATION_JSON)
public class ReviewEligibilityResource {
    @Inject DataSource database;
    @ConfigProperty(name = "internal.api.key") String internalKey;

    @GET @Path("/{orderItemId}/{userId}")
    public Map<String, Object> check(@PathParam("orderItemId") UUID orderItemId,
            @PathParam("userId") UUID userId, @HeaderParam("X-Internal-Key") String provided) {
        Api.require(provided != null && MessageDigest.isEqual(
                provided.getBytes(StandardCharsets.UTF_8), internalKey.getBytes(StandardCharsets.UTF_8)),
                403, "FORBIDDEN", "Không có quyền truy cập");
        Map<String, Object> item = Sql.one(database,
                "SELECT oi.id AS order_item_id,oi.product_id,oi.variant_id,oi.size,oi.color,"
                + "o.id AS order_id,o.status,COALESCE((SELECT max(h.changed_at) FROM order_status_history h "
                + "WHERE h.order_id=o.id AND h.status='DELIVERED'),o.updated_at) AS delivered_at "
                + "FROM order_items oi JOIN orders o ON o.id=oi.order_id "
                + "WHERE oi.id=? AND o.user_id=?", orderItemId, userId);
        Api.require(item != null, 404, "ORDER_ITEM_NOT_FOUND", "Không tìm thấy sản phẩm trong đơn hàng của bạn");
        Instant deliveredAt = ((Timestamp) item.get("deliveredAt")).toInstant();
        Instant deadline = deliveredAt.plusSeconds(30L * 24 * 60 * 60);
        boolean delivered = "DELIVERED".equals(item.get("status"));
        Map<String, Object> result = new LinkedHashMap<>(item);
        result.put("eligible", delivered && !Instant.now().isAfter(deadline));
        result.put("deadline", delivered ? deadline : null);
        result.remove("deliveredAt");
        return Api.ok(result);
    }
}
