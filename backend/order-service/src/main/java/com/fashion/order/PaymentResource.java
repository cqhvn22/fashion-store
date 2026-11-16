package com.fashion.order;

import com.fashion.common.Api;
import com.fashion.common.Sql;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.sql.Connection;
import java.sql.SQLException;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import javax.sql.DataSource;

@Path("/api/v1/payments/payos/webhook")
@Consumes(MediaType.APPLICATION_JSON)
@Produces(MediaType.APPLICATION_JSON)
public class PaymentResource {
    @Inject DataSource database;
    @Inject ObjectMapper json;
    @Inject PayosClient payos;
    @Inject CatalogClient catalog;
    @Inject OrderResource orders;
    @Inject LoyaltyResource loyalty;

    @POST
    public Map<String, Object> webhook(JsonNode body) {
        Api.require(body != null && payos.verifyWebhook(body.path("data"),
                body.path("signature").asText(null)), 401, "INVALID_SIGNATURE", "Chữ ký PayOS không hợp lệ");
        if (!body.path("success").asBoolean() || !"00".equals(body.path("code").asText())
                || !"00".equals(body.path("data").path("code").asText())) {
            return Api.ok(Map.of("accepted", true));
        }
        JsonNode data = body.path("data");
        long providerCode = data.path("orderCode").asLong(-1);
        long amount = data.path("amount").asLong(-1);
        String linkId = data.path("paymentLinkId").asText();
        UUID checkoutId = null;
        boolean cancelled = false;
        try (Connection connection = database.getConnection()) {
            connection.setAutoCommit(false);
            Map<String, Object> attempt = Sql.one(connection,
                    "SELECT a.id AS attempt_id,a.order_id,a.amount,a.payment_link_id,a.status AS attempt_status,o.checkout_id,o.status AS order_status,o.user_id,o.payment_status FROM payment_attempts a JOIN orders o ON o.id=a.order_id WHERE a.provider_order_code=? FOR UPDATE OF a,o",
                    providerCode);
            if (attempt == null) {
                // PayOS sends a signed sample when registering the webhook URL.
                connection.commit();
                return Api.ok(Map.of("accepted", true));
            }
            Api.require(((Number) attempt.get("amount")).longValue() == amount
                    && linkId.equals(attempt.get("paymentLinkId")), 409,
                    "PAYMENT_MISMATCH", "Thông tin thanh toán không khớp");
            UUID attemptId = (UUID) attempt.get("attemptId");
            UUID orderId = (UUID) attempt.get("orderId");
            checkoutId = (UUID) attempt.get("checkoutId");
            cancelled = "CANCELLED".equals(attempt.get("orderStatus"));
            String serialized = json.writeValueAsString(body);
            String digest = java.util.HexFormat.of().formatHex(
                    MessageDigest.getInstance("SHA-256").digest(serialized.getBytes(StandardCharsets.UTF_8)));
            Sql.update(connection,
                    "INSERT INTO payment_webhook_events(id,payment_attempt_id,payload_sha256,provider_reference,payload,processed_at) VALUES (?,?,?,?,?::jsonb,now()) ON CONFLICT (payload_sha256) DO NOTHING",
                    UUID.randomUUID(), attemptId, digest, data.path("reference").asText(null), serialized);
            if (!"PAID".equals(attempt.get("attemptStatus"))) {
                Sql.update(connection,
                        "UPDATE payment_attempts SET status='PAID',paid_at=now(),updated_at=now() WHERE id=?", attemptId);
                Sql.update(connection,
                        "UPDATE orders SET payment_status='PAID',status=CASE WHEN status='PENDING' THEN 'CONFIRMED' ELSE status END,updated_at=now() WHERE id=?",
                        orderId);
                Sql.update(connection,
                        "INSERT INTO payment_status_history(id,order_id,payment_attempt_id,previous_status,status,reason) VALUES (?,?,?,?,?,'PAYOS_WEBHOOK')",
                        UUID.randomUUID(), orderId, attemptId, attempt.get("paymentStatus"), "PAID");
                if ("PENDING".equals(attempt.get("orderStatus"))) {
                    Sql.update(connection,
                            "INSERT INTO order_status_history(id,order_id,status,actor_role) VALUES (?,?,'CONFIRMED','SYSTEM')",
                            UUID.randomUUID(), orderId);
                }
                orders.event(connection, orderId, "fashion.payment.paid.v1",
                        Map.of("orderId", orderId.toString(),
                                "userId", attempt.get("userId").toString(),
                                "paymentAttemptId", attemptId.toString(),
                                "amount", amount, "paidAt", Instant.now().toString()));
                loyalty.award(connection, orderId);
            }
            connection.commit();
        } catch (SQLException error) {
            throw new IllegalStateException("Payment processing failed", error);
        } catch (java.io.IOException | java.security.NoSuchAlgorithmException error) {
            throw new IllegalStateException("Payment payload processing failed", error);
        }
        if (!cancelled && checkoutId != null) catalog.commit(checkoutId);
        return Api.ok(Map.of("accepted", true));
    }
}
