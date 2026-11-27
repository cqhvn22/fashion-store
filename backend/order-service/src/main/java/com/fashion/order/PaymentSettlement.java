package com.fashion.order;

import com.fashion.common.Api;
import com.fashion.common.Sql;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.sql.Connection;
import java.sql.SQLException;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import javax.sql.DataSource;

@ApplicationScoped
public class PaymentSettlement {
    @Inject DataSource database;
    @Inject ObjectMapper json;
    @Inject CatalogClient catalog;
    @Inject LoyaltyResource loyalty;

    public boolean confirmProviderState(JsonNode state, long code, long amount, String reason) {
        if (!"PAID".equals(state.path("status").asText())) return false;
        Api.require(state.path("orderCode").asLong(-1) == code && state.path("amount").asLong(-1) == amount
                && state.path("amountPaid").asLong(-1) >= amount && state.hasNonNull("id"),
                409, "PAYMENT_MISMATCH", "Giao dịch không khớp đơn hàng");
        confirmPaid(code, amount, state.get("id").asText(), reason, null);
        return true;
    }

    public void confirmPaid(long providerCode, long amount, String linkId,
            String reason, JsonNode webhookBody) {
        UUID checkoutId = null;
        boolean commitReservation = false;
        try (Connection connection = database.getConnection()) {
            connection.setAutoCommit(false);
            Map<String, Object> attempt = Sql.one(connection,
                    "SELECT a.id AS attempt_id,a.order_id,a.amount,a.payment_link_id,a.status AS attempt_status,"
                    + "o.checkout_id,o.status AS order_status,o.user_id,o.payment_status "
                    + "FROM payment_attempts a JOIN orders o ON o.id=a.order_id "
                    + "WHERE a.provider_order_code=? FOR UPDATE OF a,o",
                    providerCode);
            if (attempt == null) {
                // PayOS sends a signed sample when registering a webhook URL.
                Api.require(webhookBody != null, 404, "PAYMENT_NOT_FOUND", "Không tìm thấy thanh toán");
                connection.commit();
                return;
            }
            Api.require(((Number) attempt.get("amount")).longValue() == amount
                    && linkId != null && linkId.equals(attempt.get("paymentLinkId")), 409,
                    "PAYMENT_MISMATCH", "Thông tin thanh toán không khớp");
            UUID attemptId = (UUID) attempt.get("attemptId");
            UUID orderId = (UUID) attempt.get("orderId");
            checkoutId = (UUID) attempt.get("checkoutId");
            commitReservation = !"CANCELLED".equals(attempt.get("orderStatus"));
            if (webhookBody != null) {
                String serialized = json.writeValueAsString(webhookBody);
                String digest = java.util.HexFormat.of().formatHex(
                        MessageDigest.getInstance("SHA-256")
                                .digest(serialized.getBytes(StandardCharsets.UTF_8)));
                Sql.update(connection,
                        "INSERT INTO payment_webhook_events(id,payment_attempt_id,payload_sha256,provider_reference,payload,processed_at) "
                        + "VALUES (?,?,?,?,?::jsonb,now()) ON CONFLICT (payload_sha256) DO NOTHING",
                        UUID.randomUUID(), attemptId, digest,
                        webhookBody.path("data").path("reference").asText(null), serialized);
            }
            if (!"PAID".equals(attempt.get("attemptStatus"))) {
                Sql.update(connection,
                        "UPDATE payment_attempts SET status='PAID',paid_at=now(),updated_at=now() WHERE id=?", attemptId);
                Sql.update(connection,
                        "UPDATE orders SET payment_status='PAID',"
                        + "status=CASE WHEN status='PENDING' THEN 'CONFIRMED' ELSE status END,updated_at=now() WHERE id=?",
                        orderId);
                Sql.update(connection,
                        "INSERT INTO payment_status_history(id,order_id,payment_attempt_id,previous_status,status,reason) "
                        + "VALUES (?,?,?,?,?,?)",
                        UUID.randomUUID(), orderId, attemptId, attempt.get("paymentStatus"), "PAID", reason);
                if ("PENDING".equals(attempt.get("orderStatus"))) {
                    Sql.update(connection,
                            "INSERT INTO order_status_history(id,order_id,status,actor_role) "
                            + "VALUES (?,?,'CONFIRMED','SYSTEM')",
                            UUID.randomUUID(), orderId);
                }
                Sql.update(connection,
                        "INSERT INTO outbox_events(id,aggregate_id,event_type,payload) VALUES (?,?,?,?::jsonb)",
                        UUID.randomUUID(), orderId, "fashion.payment.paid.v1",
                        json.writeValueAsString(Map.of(
                                "orderId", orderId.toString(),
                                "userId", attempt.get("userId").toString(),
                                "paymentAttemptId", attemptId.toString(),
                                "amount", amount, "paidAt", Instant.now().toString())));
                loyalty.award(connection, orderId);
            }
            connection.commit();
        } catch (SQLException error) {
            throw new IllegalStateException("Payment processing failed", error);
        } catch (java.io.IOException | java.security.NoSuchAlgorithmException error) {
            throw new IllegalStateException("Payment payload processing failed", error);
        }
        if (commitReservation && checkoutId != null) catalog.commit(checkoutId);
    }
}
