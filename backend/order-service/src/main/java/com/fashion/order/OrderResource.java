package com.fashion.order;

import com.fashion.common.Api;
import com.fashion.common.DivisionRules;
import com.fashion.common.Sql;
import com.fashion.inventory.grpc.ItemSnapshot;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.security.RolesAllowed;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import javax.sql.DataSource;
import org.eclipse.microprofile.jwt.JsonWebToken;

@Path("/api/v1")
@Consumes(MediaType.APPLICATION_JSON)
@Produces(MediaType.APPLICATION_JSON)
public class OrderResource {
    @Inject DataSource database;
    @Inject JsonWebToken jwt;
    @Inject ObjectMapper json;
    @Inject CatalogClient catalog;
    @Inject PayosClient payos;
    @Inject LoyaltyResource loyalty;

    public record Item(UUID variantId, int quantity, Long expectedUnitPrice) {}
    public record Address(String recipientName, String phone, String province,
            String district, String ward, String detail) {}
    public record Checkout(List<Item> items, Address shippingAddress,
            String paymentMethod, String note) {}
    public record StatusChange(String status) {}

    @POST @Path("/orders")
    @RolesAllowed({"USER", "ADMIN"})
    public Map<String, Object> create(@HeaderParam("Idempotency-Key") String idempotencyKey,
            Checkout request) {
        Api.require(idempotencyKey != null && !idempotencyKey.isBlank() && idempotencyKey.length() <= 120,
                400, "IDEMPOTENCY_REQUIRED", "Thiếu Idempotency-Key");
        Api.require(request != null && request.items() != null && !request.items().isEmpty()
                && request.items().size() <= 50 && request.shippingAddress() != null
                && validAddress(request.shippingAddress())
                && (request.note() == null || request.note().length() <= 1000),
                400, "INVALID_ORDER", "Đơn hàng không hợp lệ");
        String method = request.paymentMethod() == null ? "COD" : request.paymentMethod();
        Api.require(List.of("COD", "PAYOS").contains(method), 400,
                "INVALID_PAYMENT_METHOD", "Phương thức thanh toán không hợp lệ");
        if ("PAYOS".equals(method)) payos.requireConfigured();
        Api.require(request.items().stream().allMatch(i -> i != null && i.variantId() != null && i.quantity() > 0
                && (i.expectedUnitPrice() == null || i.expectedUnitPrice() >= 1000))
                && request.items().stream().map(Item::variantId).distinct().count() == request.items().size(),
                400, "INVALID_ITEMS", "Biến thể hoặc số lượng không hợp lệ");
        UUID userId = userId();
        Map<String, Object> existing = Sql.one(database,
                "SELECT id FROM orders WHERE user_id=? AND idempotency_key=?", userId, idempotencyKey);
        if (existing != null) {
            UUID existingId = (UUID) existing.get("id");
            Map<String, Object> previous = order(existingId, false);
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> previousItems = (List<Map<String, Object>>) previous.get("items");
            boolean sameItems = previousItems.size() == request.items().size()
                    && request.items().stream().allMatch(item -> previousItems.stream().anyMatch(stored ->
                            item.variantId().equals(stored.get("variantId"))
                                    && item.quantity() == ((Number) stored.get("quantity")).intValue()));
            Api.require(method.equals(previous.get("paymentMethod")) && sameItems
                    && json.valueToTree(request.shippingAddress()).equals(previous.get("shippingAddress")),
                    409, "IDEMPOTENCY_CONFLICT", "Idempotency-Key đã dùng cho yêu cầu khác");
            if ("PAYOS".equals(previous.get("paymentMethod"))
                    && "PENDING".equals(previous.get("status"))
                    && previous.get("checkoutUrl") == null) {
                Map<String, Object> attempt = Sql.one(database,
                        "SELECT provider_order_code,amount,expires_at FROM payment_attempts WHERE order_id=? ORDER BY created_at DESC LIMIT 1",
                        existingId);
                Api.require(attempt != null
                        && ((Timestamp) attempt.get("expiresAt")).toInstant().isAfter(Instant.now()),
                        409, "PAYMENT_EXPIRED", "Liên kết thanh toán đã hết hạn");
                createPayosLink(existingId,
                        ((Number) attempt.get("providerOrderCode")).longValue(),
                        ((Number) attempt.get("amount")).longValue(),
                        ((Timestamp) attempt.get("expiresAt")).toInstant());
            }
            return Api.ok(order(existingId, false));
        }

        UUID orderId = UUID.randomUUID();
        UUID checkoutId = UUID.randomUUID();
        Instant expiresAt = Instant.now().plusSeconds(15 * 60);
        List<ItemSnapshot> snapshots = catalog.reserve(checkoutId, request.items(), expiresAt);
        Api.require(snapshots.size() == request.items().size(),
                502, "CATALOG_ERROR", "Catalog trả dữ liệu không đầy đủ");
        for (ItemSnapshot snapshot : snapshots) {
            Item expected = request.items().stream()
                    .filter(item -> item.variantId().toString().equals(snapshot.getVariantId()))
                    .findFirst().orElseThrow();
            if (expected.expectedUnitPrice() != null && snapshot.getPrice() > expected.expectedUnitPrice()) {
                catalog.release(checkoutId);
                throw Api.error(409, "PRICE_CHANGED",
                        "Giá sản phẩm đã tăng. Vui lòng kiểm tra lại giỏ hàng trước khi đặt.");
            }
        }
        long subtotal = 0;
        for (ItemSnapshot item : snapshots) {
            subtotal = Math.addExact(subtotal,
                    Math.multiplyExact(item.getPrice(), item.getQuantity()));
        }
        long fee = subtotal >= 500_000 ? 0 : 30_000;
        LoyaltyResource.Discount tierDiscount;
        try {
            tierDiscount = loyalty.bestDiscount(userId, subtotal);
        } catch (RuntimeException error) {
            catalog.release(checkoutId);
            throw error;
        }
        long discount = tierDiscount == null ? 0 : tierDiscount.amount();
        long total = Math.subtractExact(Math.addExact(subtotal, fee), discount);
        String code = "FH-" + orderId.toString().substring(0, 12).toUpperCase();
        long providerCode = 0;
        try (Connection connection = database.getConnection()) {
            connection.setAutoCommit(false);
            if ("PAYOS".equals(method)) {
                providerCode = ((Number) Sql.one(connection,
                        "SELECT nextval('payos_order_code_seq') AS code").get("code")).longValue();
            }
            Sql.update(connection,
                    "INSERT INTO orders(id,order_code,user_id,checkout_id,idempotency_key,status,payment_method,payment_status,shipping_address,subtotal,shipping_fee,discount_amount,total_amount,note,tier_promotion_id) VALUES (?,?,?,?,?,'PENDING',?,?,?::jsonb,?,?,?,?,?,?)",
                    orderId, code, userId, checkoutId, idempotencyKey, method,
                    "PAYOS".equals(method) ? "PENDING" : "UNPAID",
                    json.writeValueAsString(request.shippingAddress()), subtotal, fee, discount, total,
                    request.note(), tierDiscount == null ? null : tierDiscount.promotionId());
            for (ItemSnapshot item : snapshots) {
                long price = item.getPrice();
                int quantity = item.getQuantity();
                Sql.update(connection,
                        "INSERT INTO order_items(id,order_id,product_id,variant_id,product_name,sku,image_url,size,color,unit_price,quantity,line_total) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
                        UUID.randomUUID(), orderId,
                        UUID.fromString(item.getProductId()),
                        UUID.fromString(item.getVariantId()),
                        item.getProductName(), item.getSku(),
                        item.getImageUrl().isBlank() ? null : item.getImageUrl(),
                        item.getSize(), item.getColor(),
                        price, quantity, Math.multiplyExact(price, quantity));
            }
            Sql.update(connection,
                    "INSERT INTO order_status_history(id,order_id,status,actor_id,actor_role) VALUES (?,?,'PENDING',?,'USER')",
                    UUID.randomUUID(), orderId, userId);
            Sql.update(connection,
                    "INSERT INTO payment_status_history(id,order_id,status,reason) VALUES (?,?,?,'ORDER_CREATED')",
                    UUID.randomUUID(), orderId, "PAYOS".equals(method) ? "PENDING" : "UNPAID");
            if ("PAYOS".equals(method)) {
                Sql.update(connection,
                        "INSERT INTO payment_attempts(id,order_id,provider_order_code,amount,expires_at) VALUES (?,?,?,?,?)",
                        UUID.randomUUID(), orderId, providerCode, total, Timestamp.from(expiresAt));
            }
            event(connection, orderId, "fashion.order.created.v1", Map.of(
                    "orderId", orderId.toString(), "userId", userId.toString(),
                    "orderCode", code, "totalAmount", total, "createdAt", Instant.now().toString()));
            connection.commit();
        } catch (Exception error) {
            catalog.release(checkoutId);
            if (error instanceof RuntimeException runtime) throw runtime;
            throw new IllegalStateException("Order creation failed", error);
        }
        if ("COD".equals(method)) {
            catalog.commit(checkoutId);
            Sql.update(database, "UPDATE orders SET status='CONFIRMED',updated_at=now() WHERE id=?", orderId);
            Sql.update(database,
                    "INSERT INTO order_status_history(id,order_id,status,actor_role) VALUES (?,?,'CONFIRMED','SYSTEM')",
                    UUID.randomUUID(), orderId);
        } else {
            createPayosLink(orderId, providerCode, total, expiresAt);
        }
        return Api.ok(order(orderId, false));
    }

    @GET @Path("/orders/my")
    @RolesAllowed({"USER", "ADMIN"})
    public Map<String, Object> mine() {
        List<Map<String, Object>> ids = Sql.list(database,
                "SELECT id FROM orders WHERE user_id=? ORDER BY created_at DESC", userId());
        return Api.ok(ids.stream().map(row -> order((UUID) row.get("id"), false)).toList());
    }

    @GET @Path("/orders/{id}")
    @RolesAllowed({"USER", "ADMIN"})
    public Map<String, Object> one(@PathParam("id") UUID id) {
        return Api.ok(order(id, false));
    }

    @GET @Path("/orders/{id}/payment")
    @RolesAllowed({"USER", "ADMIN"})
    public Map<String, Object> payment(@PathParam("id") UUID id) {
        Map<String, Object> order = order(id, false);
        Map<String, Object> attempt = Sql.one(database,
                "SELECT status,checkout_url,expires_at,paid_at FROM payment_attempts WHERE order_id=? ORDER BY created_at DESC LIMIT 1",
                id);
        return Api.ok(Map.of("orderId", id, "paymentMethod", order.get("paymentMethod"),
                "paymentStatus", order.get("paymentStatus"),
                "attempt", attempt == null ? Map.of() : attempt));
    }

    @PATCH @Path("/orders/{id}/cancel")
    @RolesAllowed({"USER", "ADMIN"})
    public Map<String, Object> cancel(@PathParam("id") UUID id) {
        Map<String, Object> current = order(id, false);
        Api.require(List.of("PENDING", "CONFIRMED").contains(current.get("status"))
                && !"PAID".equals(current.get("paymentStatus")), 409,
                "CANNOT_CANCEL", "Đơn này không thể tự hủy");
        cancelPayosIfNeeded(id, current);
        changeStatus(id, "CANCELLED", false);
        catalog.release((UUID) current.get("checkoutId"));
        return Api.ok(order(id, false));
    }

    @GET @Path("/admin/orders")
    @RolesAllowed("ADMIN")
    public Map<String, Object> adminOrders() {
        List<Map<String, Object>> ids = Sql.list(database,
                "SELECT id FROM orders ORDER BY created_at DESC LIMIT 500");
        return Api.ok(ids.stream().map(row -> order((UUID) row.get("id"), true)).toList());
    }

    @GET @Path("/admin/orders/{id}")
    @RolesAllowed("ADMIN")
    public Map<String, Object> adminOne(@PathParam("id") UUID id) {
        return Api.ok(order(id, true));
    }

    @PATCH @Path("/admin/orders/{id}/status")
    @RolesAllowed("ADMIN")
    public Map<String, Object> adminStatus(@PathParam("id") UUID id, StatusChange request) {
        Api.require(request != null && request.status() != null,
                400, "INVALID_STATUS", "Thiếu trạng thái");
        if ("CANCELLED".equals(request.status())) cancelPayosIfNeeded(id, order(id, true));
        changeStatus(id, request.status(), true);
        return Api.ok(order(id, true));
    }

    @GET @Path("/admin/statistics")
    @RolesAllowed("ADMIN")
    public Map<String, Object> statistics() {
        return Api.ok(Sql.one(database,
                "SELECT count(*) AS total_orders,count(*) FILTER (WHERE status='DELIVERED') AS delivered_orders,coalesce(sum(total_amount) FILTER (WHERE status='DELIVERED'),0) AS delivered_value,coalesce(sum(total_amount) FILTER (WHERE payment_status='PAID'),0) AS collected_amount FROM orders"));
    }

    @PATCH @Path("/admin/orders/{id}/payment/collected")
    @RolesAllowed("ADMIN")
    public Map<String, Object> collectCod(@PathParam("id") UUID id) {
        try (Connection connection = database.getConnection()) {
            connection.setAutoCommit(false);
            Map<String, Object> current = Sql.one(connection,
                    "SELECT id,user_id,payment_method,payment_status,status,total_amount FROM orders WHERE id=? FOR UPDATE",
                    id);
            Api.require(current != null, 404, "NOT_FOUND", "Không tìm thấy đơn hàng");
            Api.require("COD".equals(current.get("paymentMethod"))
                    && "DELIVERED".equals(current.get("status")), 409,
                    "INVALID_PAYMENT", "Chỉ ghi nhận COD sau khi giao hàng");
            if (!"PAID".equals(current.get("paymentStatus"))) {
                Sql.update(connection,
                        "UPDATE orders SET payment_status='PAID',updated_at=now() WHERE id=?", id);
                Sql.update(connection,
                        "INSERT INTO payment_status_history(id,order_id,previous_status,status,reason) VALUES (?,?,?,'PAID','COD_COLLECTED')",
                        UUID.randomUUID(), id, current.get("paymentStatus"));
                event(connection, id, "fashion.payment.paid.v1", Map.of(
                        "orderId", id.toString(), "userId", current.get("userId").toString(),
                        "paymentAttemptId", "COD", "amount", current.get("totalAmount"),
                        "paidAt", Instant.now().toString()));
            }
            loyalty.award(connection, id);
            connection.commit();
            return Api.ok(order(id, true));
        } catch (SQLException error) {
            throw new IllegalStateException("COD collection failed", error);
        }
    }

    void changeStatus(UUID id, String next, boolean admin) {
        try (Connection connection = database.getConnection()) {
            connection.setAutoCommit(false);
            Map<String, Object> current = Sql.one(connection,
                    "SELECT id,user_id,status,payment_status,payment_method,checkout_id FROM orders WHERE id=? FOR UPDATE", id);
            Api.require(current != null, 404, "NOT_FOUND", "Không tìm thấy đơn hàng");
            if (!admin) Api.require(userId().equals(current.get("userId")), 403, "FORBIDDEN", "Không có quyền");
            String previous = (String) current.get("status");
            boolean valid = switch (previous) {
                case "PENDING" -> List.of("CONFIRMED", "CANCELLED").contains(next);
                case "CONFIRMED" -> List.of("PROCESSING", "CANCELLED").contains(next);
                case "PROCESSING" -> "SHIPPING".equals(next);
                case "SHIPPING" -> "DELIVERED".equals(next);
                default -> false;
            };
            Api.require(valid, 409, "INVALID_TRANSITION", "Chuyển trạng thái không hợp lệ");
            Api.require(!"CANCELLED".equals(next) || !"PAID".equals(current.get("paymentStatus")),
                    409, "REFUND_REQUIRED", "Đơn đã thanh toán cần quy trình hoàn tiền");
            Sql.update(connection, "UPDATE orders SET status=?,updated_at=now() WHERE id=?", next, id);
            if ("CANCELLED".equals(next)) {
                Sql.update(connection,
                        "UPDATE orders SET payment_status='CANCELLED' WHERE id=? AND payment_status<>'PAID'", id);
                Sql.update(connection,
                        "UPDATE payment_attempts SET status='CANCELLED',updated_at=now() WHERE order_id=? AND status='PENDING'", id);
                Sql.update(connection,
                        "INSERT INTO payment_status_history(id,order_id,previous_status,status,reason) VALUES (?,?,?,'CANCELLED','ORDER_CANCELLED')",
                        UUID.randomUUID(), id, current.get("paymentStatus"));
            }
            Sql.update(connection,
                    "INSERT INTO order_status_history(id,order_id,status,actor_id,actor_role) VALUES (?,?,?,?,?)",
                    UUID.randomUUID(), id, next, admin ? userId() : userId(), admin ? "ADMIN" : "USER");
            event(connection, id, "CANCELLED".equals(next)
                    ? "fashion.order.cancelled.v1" : "fashion.order.status-changed.v1",
                    Map.of("orderId", id.toString(), "userId", current.get("userId").toString(),
                            "checkoutId", current.get("checkoutId").toString(),
                            "previousStatus", previous, "status", next, "changedAt", Instant.now().toString()));
            if ("DELIVERED".equals(next)) loyalty.award(connection, id);
            connection.commit();
            if ("CANCELLED".equals(next) && admin) catalog.release((UUID) current.get("checkoutId"));
        } catch (SQLException error) {
            throw new IllegalStateException("Order status update failed", error);
        }
    }

    Map<String, Object> order(UUID id, boolean admin) {
        Map<String, Object> row = Sql.one(database,
                "SELECT id,order_code,user_id,checkout_id,status,payment_method,payment_status,shipping_address::text AS shipping_address,subtotal,shipping_fee,discount_amount,total_amount,note,tier_promotion_id,created_at,updated_at FROM orders WHERE id=?",
                id);
        Api.require(row != null, 404, "NOT_FOUND", "Không tìm thấy đơn hàng");
        if (!admin) Api.require(userId().equals(row.get("userId")), 403, "FORBIDDEN", "Không có quyền xem đơn");
        try {
            row.put("shippingAddress", json.readTree((String) row.get("shippingAddress")));
        } catch (java.io.IOException error) {
            throw new IllegalStateException("Invalid stored address", error);
        }
        row.put("items", Sql.list(database,
                "SELECT id,product_id,variant_id,product_name,sku,image_url,size,color,unit_price,quantity,line_total FROM order_items WHERE order_id=?",
                id));
        row.put("history", Sql.list(database,
                "SELECT status,changed_at AS at FROM order_status_history WHERE order_id=? ORDER BY changed_at",
                id));
        Map<String, Object> attempt = Sql.one(database,
                "SELECT checkout_url,expires_at FROM payment_attempts WHERE order_id=? ORDER BY created_at DESC LIMIT 1",
                id);
        if (attempt != null) row.put("checkoutUrl", attempt.get("checkoutUrl"));
        return row;
    }

    void event(Connection connection, UUID orderId, String type, Map<String, Object> payload)
            throws SQLException {
        try {
            Sql.update(connection,
                    "INSERT INTO outbox_events(id,aggregate_id,event_type,payload) VALUES (?,?,?,?::jsonb)",
                    UUID.randomUUID(), orderId, type, json.writeValueAsString(payload));
        } catch (java.io.IOException error) {
            throw new IllegalStateException("Event serialization failed", error);
        }
    }

    private UUID userId() { return UUID.fromString(jwt.getSubject()); }

    private boolean validAddress(Address address) {
        return address.recipientName() != null && address.recipientName().trim().length() >= 2
                && address.recipientName().length() <= 150
                && address.phone() != null && address.phone().matches("0[0-9]{9}")
                && address.detail() != null && address.detail().trim().length() >= 5
                && address.detail().length() <= 300
                && (address.district() == null || address.district().isBlank())
                && DivisionRules.valid(address.province(), address.ward());
    }

    private void createPayosLink(UUID orderId, long providerCode, long total, Instant expiresAt) {
        JsonNode link;
        try {
            link = payos.create(providerCode, total, expiresAt);
        } catch (jakarta.ws.rs.WebApplicationException providerError) {
            // A timed-out create request may still have created the link at PayOS.
            link = payos.get(providerCode);
        }
        Api.require(link.path("orderCode").asLong() == providerCode
                && link.path("amount").asLong() == total
                && link.hasNonNull("paymentLinkId") && link.hasNonNull("checkoutUrl"),
                502, "PAYOS_INVALID_RESPONSE", "PayOS trả thông tin link không hợp lệ");
        Sql.update(database,
                "UPDATE payment_attempts SET payment_link_id=?,checkout_url=?,updated_at=now() WHERE order_id=? AND provider_order_code=?",
                link.path("paymentLinkId").asText(), link.path("checkoutUrl").asText(),
                orderId, providerCode);
    }

    private void cancelPayosIfNeeded(UUID id, Map<String, Object> current) {
        if (!"PAYOS".equals(current.get("paymentMethod"))) return;
        Api.require(!"PAID".equals(current.get("paymentStatus")), 409,
                "REFUND_REQUIRED", "Đơn đã thanh toán cần quy trình hoàn tiền");
        Map<String, Object> attempt = Sql.one(database,
                "SELECT provider_order_code,payment_link_id FROM payment_attempts WHERE order_id=? ORDER BY created_at DESC LIMIT 1",
                id);
        if (attempt != null && attempt.get("paymentLinkId") != null) {
            JsonNode result = payos.cancel(((Number) attempt.get("providerOrderCode")).longValue());
            Api.require("CANCELLED".equals(result.path("status").asText()),
                    409, "PAYMENT_IN_PROGRESS", "Thanh toán đang được xử lý");
        }
    }
}
