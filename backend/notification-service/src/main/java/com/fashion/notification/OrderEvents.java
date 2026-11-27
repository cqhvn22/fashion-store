package com.fashion.notification;

import com.fashion.common.Sql;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.sql.Connection;
import java.sql.SQLException;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import javax.sql.DataSource;
import org.eclipse.microprofile.reactive.messaging.Incoming;
import io.smallrye.common.annotation.Blocking;
import org.eclipse.microprofile.config.inject.ConfigProperty;

@ApplicationScoped
public class OrderEvents {
    @Inject DataSource database;
    @Inject ObjectMapper json;
    @ConfigProperty(name = "notification.auth.url") String authUrl;
    @ConfigProperty(name = "internal.api.key") String internalKey;
    private final HttpClient client = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(3)).build();

    @Incoming("order-created") @Blocking
    public void created(String payload) { handle("fashion.order.created.v1", payload); }
    @Incoming("order-status") @Blocking
    public void changed(String payload) { handle("fashion.order.status-changed.v1", payload); }
    @Incoming("order-cancelled") @Blocking
    public void cancelled(String payload) { handle("fashion.order.cancelled.v1", payload); }
    @Incoming("payment-paid") @Blocking
    public void paid(String payload) { handle("fashion.payment.paid.v1", payload); }

    private void handle(String type, String payload) {
        try {
            JsonNode data = json.readTree(payload);
            UUID eventId = UUID.fromString(data.path("eventId").asText());
            UUID userId = UUID.fromString(data.path("userId").asText());
            UUID orderId = UUID.fromString(data.path("orderId").asText());
            List<UUID> adminIds = "fashion.order.created.v1".equals(type) ? activeAdmins() : List.of();
            try (Connection connection = database.getConnection()) {
                connection.setAutoCommit(false);
                int inserted = Sql.update(connection,
                        "INSERT INTO processed_events(event_id,event_type) VALUES (?,?) ON CONFLICT DO NOTHING",
                        eventId, type);
                if (inserted == 1) {
                    boolean remind = "fashion.order.created.v1".equals(type)
                            && "PAYOS".equals(data.path("paymentMethod").asText()) && data.hasNonNull("paymentExpiresAt");
                    var deadline = remind ? java.sql.Timestamp.from(java.time.Instant.parse(data.get("paymentExpiresAt").asText())) : null;
                    String body = switch (type) {
                        case "fashion.order.created.v1" -> "Đơn " + data.path("orderCode").asText()
                                + (remind ? " đang chờ thanh toán. Mở mã QR để chuyển khoản trước khi hết hạn."
                                          : " đã được đặt thành công.");
                        case "fashion.order.cancelled.v1" -> "Đơn hàng của bạn đã bị hủy.";
                        case "fashion.payment.paid.v1" -> "Thanh toán đơn hàng đã được xác nhận.";
                        default -> "Đơn hàng của bạn đã chuyển sang trạng thái " + statusName(data.path("status").asText()) + ".";
                    };
                    Sql.update(connection,
                            "INSERT INTO notifications(id,event_id,recipient_user_id,order_id,channel,destination,subject,body,status,sent_at,payment_reminder_until) VALUES (?,?,?,?,'IN_APP',?,?,?,'SENT',now(),?)",
                            UUID.randomUUID(), eventId, userId, orderId, userId.toString(),
                            remind ? "Chờ thanh toán PayOS" : "Đơn hàng", body, deadline);
                    for (UUID adminId : adminIds) {
                        Sql.update(connection,
                                "INSERT INTO notifications(id,event_id,recipient_user_id,order_id,channel,destination,subject,body,status,sent_at) VALUES (?,?,?,?,'IN_APP',?,?,?,'SENT',now()) ON CONFLICT DO NOTHING",
                                UUID.randomUUID(), eventId, adminId, orderId, adminId.toString(),
                                "Đơn hàng mới", "Có đơn " + data.path("orderCode").asText() + " vừa được đặt.");
                    }
                }
                connection.commit();
            }
        } catch (SQLException | java.io.IOException error) {
            throw new IllegalStateException("Notification event processing failed", error);
        }
    }

    private List<UUID> activeAdmins() {
        HttpRequest request = HttpRequest.newBuilder(URI.create(authUrl + "/api/v1/internal/admin-users"))
                .header("X-Internal-Key", internalKey).timeout(Duration.ofSeconds(5)).GET().build();
        try {
            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) throw new IllegalStateException("Cannot load admin recipients");
            List<UUID> ids = new ArrayList<>();
            for (JsonNode user : json.readTree(response.body()).path("data"))
                ids.add(UUID.fromString(user.path("id").asText()));
            return ids;
        } catch (IOException | InterruptedException error) {
            if (error instanceof InterruptedException) Thread.currentThread().interrupt();
            throw new IllegalStateException("Cannot load admin recipients", error);
        }
    }

    private String statusName(String status) {
        return switch (status) {
            case "CONFIRMED" -> "đã xác nhận";
            case "PROCESSING" -> "đang chuẩn bị hàng";
            case "SHIPPING" -> "đang giao";
            case "DELIVERED" -> "đã giao";
            case "CANCELLED" -> "đã hủy";
            default -> status;
        };
    }
}
