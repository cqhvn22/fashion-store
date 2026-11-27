package com.fashion.auth;

import com.fashion.common.Api;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@ApplicationScoped
class ResendMail {
    private static final Logger LOG = Logger.getLogger(ResendMail.class);
    private static final URI SEND_URL = URI.create("https://api.resend.com/emails");
    private final HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    @Inject ObjectMapper json;
    @ConfigProperty(name = "resend.api-key", defaultValue = "") java.util.Optional<String> key;
    @ConfigProperty(name = "resend.from", defaultValue = "") java.util.Optional<String> from;
    @ConfigProperty(name = "mail.public-url", defaultValue = "http://localhost:3000") String publicUrl;
    @ConfigProperty(name = "resend.requests-per-second", defaultValue = "2") int requestsPerSecond;
    private long nextRequest;

    record Result(boolean accepted, boolean retryable, int retryAfter, String error) {}

    void requireConfigured() {
        Api.require(configured(), 503, "MAIL_NOT_CONFIGURED",
                "Dịch vụ email chưa sẵn sàng. Vui lòng thử lại sau.");
    }

    boolean configured() {
        return key.filter(value -> !value.isBlank()).isPresent()
                && from.filter(value -> !value.isBlank()).isPresent();
    }

    String siteUrl() {
        return publicUrl.replaceAll("/+$", "");
    }

    Result send(String recipient, String subject, String html, String plain,
                String idempotencyKey, Map<String, String> headers) {
        if (!configured()) return new Result(false, false, 0, "Chưa cấu hình địa chỉ gửi hoặc API key");
        Map<String, Object> payload = new HashMap<>(Map.of("from", from.orElseThrow(),
                "to", List.of(recipient), "subject", subject, "html", html, "text", plain));
        if (!headers.isEmpty()) payload.put("headers", headers);
        try {
            pace();
            HttpRequest request = HttpRequest.newBuilder(SEND_URL).timeout(Duration.ofSeconds(12))
                    .header("Authorization", "Bearer " + key.orElseThrow())
                    .header("Content-Type", "application/json")
                    .header("Idempotency-Key", idempotencyKey)
                    .POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(payload))).build();
            var response = client.send(request, HttpResponse.BodyHandlers.discarding());
            int status = response.statusCode();
            if (status >= 200 && status < 300) return new Result(true, false, 0, null);
            int delay = response.headers().firstValueAsLong("retry-after").stream()
                    .mapToInt(value -> (int) Math.clamp(value, 1, 3600)).findFirst().orElse(0);
            LOG.warnf("Resend rejected a mail request (HTTP %d)", status);
            return new Result(false, status == 429 || status == 409 || status >= 500, delay, "Resend HTTP " + status);
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
            return new Result(false, true, 0, "Tác vụ gửi bị gián đoạn");
        } catch (IOException error) {
            LOG.warnf("Resend connection failed (%s)", error.getClass().getSimpleName());
            return new Result(false, true, 0, "Không thể kết nối Resend");
        }
    }

    private synchronized void pace() throws InterruptedException {
        long now = System.nanoTime();
        if (nextRequest > now) Thread.sleep(Duration.ofNanos(nextRequest - now));
        nextRequest = System.nanoTime() + 1_000_000_000L / Math.clamp(requestsPerSecond, 1, 20);
    }
}
