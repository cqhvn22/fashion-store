package com.fashion.catalog;

import com.fashion.common.Api;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import org.eclipse.microprofile.config.inject.ConfigProperty;

@ApplicationScoped
public class OrderReviewClient {
    @ConfigProperty(name = "review.order.url") String orderUrl;
    @ConfigProperty(name = "internal.api.key") String internalKey;
    @Inject ObjectMapper json;
    private final HttpClient client = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(3)).build();

    public record Eligibility(UUID orderItemId, UUID orderId, UUID productId, UUID variantId,
            String size, String color, boolean eligible, Instant deadline) {}

    public Eligibility check(UUID orderItemId, UUID userId) {
        HttpRequest request = HttpRequest.newBuilder(URI.create(orderUrl
                + "/api/v1/internal/review-eligibility/" + orderItemId + "/" + userId))
                .header("X-Internal-Key", internalKey).timeout(Duration.ofSeconds(6)).GET().build();
        try {
            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() == 404) throw Api.error(404, "ORDER_ITEM_NOT_FOUND",
                    "Không tìm thấy sản phẩm trong đơn hàng của bạn");
            if (response.statusCode() != 200) throw Api.error(502, "ORDER_UNAVAILABLE",
                    "Chưa kiểm tra được đơn hàng. Vui lòng thử lại");
            JsonNode data = json.readTree(response.body()).path("data");
            String deadline = data.path("deadline").isNull() ? null : data.path("deadline").asText(null);
            return new Eligibility(orderItemId,
                    UUID.fromString(data.path("orderId").asText()),
                    UUID.fromString(data.path("productId").asText()),
                    UUID.fromString(data.path("variantId").asText()),
                    data.path("size").asText(), data.path("color").asText(),
                    data.path("eligible").asBoolean(), deadline == null ? null : Instant.parse(deadline));
        } catch (IOException | InterruptedException error) {
            if (error instanceof InterruptedException) Thread.currentThread().interrupt();
            throw Api.error(502, "ORDER_UNAVAILABLE", "Chưa kiểm tra được đơn hàng. Vui lòng thử lại");
        }
    }
}
