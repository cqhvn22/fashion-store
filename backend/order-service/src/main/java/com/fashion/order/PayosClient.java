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
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.eclipse.microprofile.config.inject.ConfigProperty;

@ApplicationScoped
public class PayosClient {
    @Inject ObjectMapper json;
    @ConfigProperty(name = "payos.client-id") String clientId;
    @ConfigProperty(name = "payos.api-key") String apiKey;
    @ConfigProperty(name = "payos.checksum-key") String checksumKey;
    @ConfigProperty(name = "payos.return-url") String returnUrl;
    @ConfigProperty(name = "payos.cancel-url") String cancelUrl;
    @ConfigProperty(name = "payos.api-url") String apiUrl;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();

    public JsonNode create(long code, long amount, Instant expiresAt) {
        ready();
        Api.require(amount > 0 && amount <= Integer.MAX_VALUE, 400,
                "INVALID_AMOUNT", "Số tiền PayOS không hợp lệ");
        String description = "FH" + code;
        Api.require(description.length() <= 9, 400, "INVALID_ORDER_CODE",
                "Mã PayOS vượt độ dài mô tả");
        Map<String, Object> payload = Map.of(
                "orderCode", code, "amount", amount, "description", description,
                "returnUrl", returnUrl, "cancelUrl", cancelUrl,
                "expiredAt", expiresAt.getEpochSecond(),
                "signature", hmac("amount=" + amount + "&cancelUrl=" + cancelUrl
                        + "&description=" + description + "&orderCode=" + code
                        + "&returnUrl=" + returnUrl));
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
                    .header("Content-Type", "application/json");
            HttpRequest request = builder.method(method,
                    body == null ? HttpRequest.BodyPublishers.noBody()
                            : HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body))).build();
            HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
            JsonNode result = json.readTree(response.body());
            Api.require(response.statusCode() == 200 && "00".equals(result.path("code").asText()),
                    502, "PAYOS_UNAVAILABLE", "PayOS chưa xử lý được yêu cầu");
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
