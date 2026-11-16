package com.fashion.order;

import com.fashion.common.Sql;
import com.fasterxml.jackson.databind.JsonNode;
import io.quarkus.scheduler.Scheduled;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.sql.Connection;
import java.sql.SQLException;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import javax.sql.DataSource;
import org.jboss.logging.Logger;

@ApplicationScoped
public class PaymentReconciler {
    private static final Logger LOG = Logger.getLogger(PaymentReconciler.class);
    @Inject DataSource database;
    @Inject PayosClient payos;
    @Inject CatalogClient catalog;
    @Inject OrderResource orders;

    @Scheduled(every = "1m", concurrentExecution = Scheduled.ConcurrentExecution.SKIP)
    void expireLinks() {
        List<Map<String, Object>> expired = Sql.list(database,
                "SELECT id,provider_order_code FROM payment_attempts WHERE status='PENDING' AND expires_at<now() ORDER BY expires_at LIMIT 50");
        for (Map<String, Object> candidate : expired) {
            try {
                long code = ((Number) candidate.get("providerOrderCode")).longValue();
                JsonNode state = payos.get(code);
                String status = state.path("status").asText();
                if ("PAID".equals(status)) {
                    LOG.warnf("PayOS payment %s is paid but webhook not applied; manual reconciliation required", code);
                    continue;
                }
                if ("PENDING".equals(status)) {
                    status = payos.cancel(code).path("status").asText();
                }
                if (!List.of("CANCELLED", "EXPIRED").contains(status)) continue;
                UUID checkoutId = null;
                try (Connection connection = database.getConnection()) {
                    connection.setAutoCommit(false);
                    Map<String, Object> attempt = Sql.one(connection,
                            "SELECT a.id,a.order_id,a.status,o.checkout_id,o.user_id,o.status AS order_status FROM payment_attempts a JOIN orders o ON o.id=a.order_id WHERE a.id=? FOR UPDATE OF a,o",
                            candidate.get("id"));
                    if (attempt == null || !"PENDING".equals(attempt.get("status"))) {
                        connection.commit();
                        continue;
                    }
                    UUID orderId = (UUID) attempt.get("orderId");
                    checkoutId = (UUID) attempt.get("checkoutId");
                    Sql.update(connection,
                            "UPDATE payment_attempts SET status='EXPIRED',updated_at=now() WHERE id=?",
                            candidate.get("id"));
                    Sql.update(connection,
                            "UPDATE orders SET payment_status='EXPIRED',status='CANCELLED',updated_at=now() WHERE id=?",
                            orderId);
                    Sql.update(connection,
                            "INSERT INTO payment_status_history(id,order_id,payment_attempt_id,previous_status,status,reason) VALUES (?,?,?,'PENDING','EXPIRED','PAYOS_LINK_EXPIRED')",
                            UUID.randomUUID(), orderId, candidate.get("id"));
                    Sql.update(connection,
                            "INSERT INTO order_status_history(id,order_id,status,actor_role) VALUES (?,?,'CANCELLED','SYSTEM')",
                            UUID.randomUUID(), orderId);
                    orders.event(connection, orderId, "fashion.order.cancelled.v1",
                            Map.of("orderId", orderId.toString(),
                                    "userId", attempt.get("userId").toString(),
                                    "checkoutId", checkoutId.toString(),
                                    "cancelledAt", Instant.now().toString()));
                    connection.commit();
                }
                if (checkoutId != null) catalog.release(checkoutId);
            } catch (Exception error) {
                LOG.warn("PayOS expiry reconciliation failed; will retry", error);
            }
        }
    }
}
