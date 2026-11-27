package com.fashion.order;

import com.fashion.common.Api;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.TreeMap;
import java.util.UUID;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import jakarta.ws.rs.core.UriBuilder;
import org.jboss.logging.Logger;

@ApplicationScoped
public class PayosClient {
    private static final Logger LOG = Logger.getLogger(PayosClient.class);
    @Inject ObjectMapper json;
    @ConfigProperty(name = "payos.client-id") String clientId;
    @ConfigProperty(name = "payos.api-key") String apiKey;
    @ConfigProperty(name = "payos.checksum-key") String checksumKey;
    @ConfigProperty(name = "payos.return-url") String returnUrl;
    @ConfigProperty(name = "payos.cancel-url") String cancelUrl;
    @ConfigProperty(name = "payos.api-url") String apiUrl;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();

    public JsonNode create(long code, long amount, Instant expiresAt, UUID orderId) {
        ready();
        Api.require(amount > 0 && amount <= Integer.MAX_VALUE, 400,
                "INVALID_AMOUNT", "Số tiền PayOS không hợp lệ");
        String description = "FH" + code;
        Api.require(description.length() <= 9, 400, "INVALID_ORDER_CODE",
                "Mã PayOS vượt độ dài mô tả");
        String orderReturnUrl = UriBuilder.fromUri(returnUrl).queryParam("orderId", orderId).build().toString();
        String orderCancelUrl = UriBuilder.fromUri(cancelUrl).queryParam("orderId", orderId).build().toString();
        Map<String, Object> payload = Map.of(
                "orderCode", code, "amount", amount, "description", description,
                "returnUrl", orderReturnUrl, "cancelUrl", orderCancelUrl,
                "expiredAt", expiresAt.getEpochSecond(),
                "signature", hmac("amount=" + amount + "&cancelUrl=" + orderCancelUrl
                        + "&description=" + description + "&orderCode=" + code
                        + "&returnUrl=" + orderReturnUrl));
        return request("POST", "/v2/payment-requests", payload).path("data");
    }

    public void requireConfigured() { ready(); }

    public JsonNode get(long code) {
        ready();
        return request("GET", "/v2/payment-requests/" + code, null).path("data");
    }

    public JsonNode cancel(long code) {
        ready();
        return request("POST", "/v2/payment-requests/" + code + "/cancel",
                Map.of("cancellationReason", "Customer cancelled order")).path("data");
    }

    public boolean verifyWebhook(JsonNode data, String signature) {
        if (data == null || !data.isObject() || signature == null || "disabled".equals(checksumKey)) return false;
        TreeMap<String, String> sorted = new TreeMap<>();
        data.fields().forEachRemaining(entry -> {
            JsonNode value = entry.getValue();
            sorted.put(entry.getKey(), value.isNull() ? ""
                    : value.isValueNode() ? value.asText() : value.toString());
        });
        String canonical = sorted.entrySet().stream()
                .map(entry -> entry.getKey() + "=" + entry.getValue())
                .collect(java.util.stream.Collectors.joining("&"));
        return MessageDigest.isEqual(hmac(canonical).getBytes(StandardCharsets.US_ASCII),
                signature.toLowerCase().getBytes(StandardCharsets.US_ASCII));
    }

    private JsonNode request(String method, String path, Object body) {
        try {
            HttpRequest.Builder builder = HttpRequest.newBuilder(URI.create(apiUrl + path))
                    .timeout(Duration.ofSeconds(10))
                    .header("x-client-id", clientId).header("x-api-key", apiKey)
                    .header("User-Agent", "FashionHub/1.0")
                    .header("Content-Type", "application/json");
            HttpRequest request = builder.method(method,
                    body == null ? HttpRequest.BodyPublishers.noBody()
                            : HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body))).build();
            HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() == 403 && response.body().contains("error code: 1010")) {
                LOG.warn("PayOS blocked the HTTP client signature (Cloudflare 1010)");
                throw Api.error(502, "PAYOS_ACCESS_DENIED",
                        "Kết nối tới PayOS bị chặn. Vui lòng thử lại hoặc liên hệ cửa hàng.");
            }
            if (response.statusCode() == 429) {
                throw Api.error(503, "PAYOS_RATE_LIMITED",
                        "PayOS đang bận. Vui lòng thử lại sau ít phút.");
            }
            if (response.statusCode() >= 500) {
                throw Api.error(502, "PAYOS_UNAVAILABLE", "PayOS tạm thời không phản hồi. Vui lòng thử lại.");
            }
            JsonNode result;
            try {
                result = json.readTree(response.body());
            } catch (com.fasterxml.jackson.core.JsonProcessingException error) {
                LOG.warnf("PayOS returned a non-JSON response: HTTP %d", response.statusCode());
                throw Api.error(502, "PAYOS_INVALID_RESPONSE",
                        "PayOS trả dữ liệu không hợp lệ. Vui lòng thử lại.");
            }
            Api.require(result != null && result.isObject(), 502, "PAYOS_INVALID_RESPONSE",
                    "PayOS trả dữ liệu không hợp lệ. Vui lòng thử lại.");
            if (response.statusCode() == 401 || response.statusCode() == 403) {
                LOG.warnf("PayOS rejected credentials: HTTP %d, code %s", response.statusCode(), result.path("code").asText());
                throw Api.error(502, "PAYOS_AUTH_FAILED",
                        "PayOS từ chối kết nối. Vui lòng liên hệ cửa hàng để kiểm tra cấu hình thanh toán.");
            }
            if (response.statusCode() >= 400 && response.statusCode() < 500
                    || response.statusCode() == 200 && !"00".equals(result.path("code").asText())) {
                LOG.warnf("PayOS rejected %s %s: HTTP %d, code %s, desc %s",
                        method, path, response.statusCode(), result.path("code").asText(), result.path("desc").asText());
                throw Api.error(502, "PAYOS_REJECTED",
                        "PayOS từ chối yêu cầu thanh toán. Vui lòng thử lại hoặc liên hệ cửa hàng.");
            }
            Api.require(response.statusCode() == 200 && "00".equals(result.path("code").asText()),
                    502, "PAYOS_UNAVAILABLE", "PayOS tạm thời không phản hồi. Vui lòng thử lại.");
            return result;
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
            throw Api.error(502, "PAYOS_UNAVAILABLE", "Kết nối PayOS bị gián đoạn");
        } catch (java.io.IOException error) {
            throw Api.error(502, "PAYOS_UNAVAILABLE", "Không thể kết nối PayOS");
        }
    }

    private String hmac(String data) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(checksumKey.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return java.util.HexFormat.of().formatHex(mac.doFinal(data.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception error) {
            throw new IllegalStateException("Cannot calculate PayOS signature", error);
        }
    }

    private void ready() {
        Api.require(!clientId.isBlank() && !apiKey.isBlank() && !checksumKey.isBlank()
                && !"disabled".equals(clientId) && !"disabled".equals(apiKey)
                && !"disabled".equals(checksumKey),
                503, "PAYOS_NOT_CONFIGURED", "Chưa cấu hình PayOS");
    }
}
