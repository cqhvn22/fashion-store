package com.fashion.order;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import jakarta.ws.rs.WebApplicationException;
import org.junit.jupiter.api.Test;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PayosClientTest {
    @Test
    void createsSignedPaymentLinkWithServerAmount() throws Exception {
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        AtomicReference<JsonNode> sent = new AtomicReference<>();
        AtomicReference<String> userAgent = new AtomicReference<>();
        server.createContext("/v2/payment-requests", exchange -> {
            userAgent.set(exchange.getRequestHeaders().getFirst("User-Agent"));
            sent.set(new ObjectMapper().readTree(exchange.getRequestBody()));
            byte[] response = """
                {"code":"00","data":{"orderCode":100001,"amount":350000,
                "paymentLinkId":"link-1","checkoutUrl":"https://pay.payos.vn/link-1"}}
                """.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, response.length);
            exchange.getResponseBody().write(response);
            exchange.close();
        });
        server.start();
        try {
            PayosClient client = new PayosClient();
            client.json = new ObjectMapper();
            client.clientId = "test-client";
            client.apiKey = "test-api-key";
            client.checksumKey = "test-checksum-key-with-at-least-32-bytes";
            client.returnUrl = "https://shop.example/success";
            client.cancelUrl = "https://shop.example/cancel";
            client.apiUrl = "http://127.0.0.1:" + server.getAddress().getPort();
            UUID orderId = UUID.fromString("467b35f5-160a-4dd4-9cf2-5ac4df8f1738");
            assertTrue(client.create(100001, 350000, Instant.now().plusSeconds(900), orderId)
                    .path("checkoutUrl").asText().contains("pay.payos.vn"));
            JsonNode body = sent.get();
            assertEquals("FashionHub/1.0", userAgent.get());
            assertTrue(body.path("returnUrl").asText().endsWith("orderId=" + orderId));
            String canonical = "amount=350000&cancelUrl=https://shop.example/cancel?orderId=" + orderId
                    + "&description=FH100001&orderCode=100001"
                    + "&returnUrl=https://shop.example/success?orderId=" + orderId;
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(client.checksumKey.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            String expected = java.util.HexFormat.of().formatHex(
                    mac.doFinal(canonical.getBytes(StandardCharsets.UTF_8)));
            assertTrue(expected.equals(body.path("signature").asText()));
        } finally {
            server.stop(0);
        }
    }

    @Test
    void reportsCloudflareBlockWithoutTreatingItAsMissingConfiguration() throws Exception {
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/v2/payment-requests", exchange -> {
            byte[] response = "error code: 1010".getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(403, response.length);
            exchange.getResponseBody().write(response);
            exchange.close();
        });
        server.start();
        try {
            PayosClient client = new PayosClient();
            client.json = new ObjectMapper();
            client.clientId = "test-client";
            client.apiKey = "test-api-key";
            client.checksumKey = "test-checksum-key-with-at-least-32-bytes";
            client.returnUrl = "https://shop.example/success";
            client.cancelUrl = "https://shop.example/cancel";
            client.apiUrl = "http://127.0.0.1:" + server.getAddress().getPort();
            WebApplicationException error = assertThrows(WebApplicationException.class,
                    () -> client.create(100001, 350000, Instant.now().plusSeconds(900), UUID.randomUUID()));
            assertEquals("PAYOS_ACCESS_DENIED", ((java.util.Map<?, ?>) error.getResponse().getEntity()).get("code"));
        } finally {
            server.stop(0);
        }
    }

    @Test
    void verifiesOfficialWebhookSampleAndRejectsTampering() throws Exception {
        PayosClient client = new PayosClient();
        client.checksumKey = "1a54716c8f0efb2744fb28b6e38b25da7f67a925d98bc1c18bd8faaecadd7675";
        ObjectMapper json = new ObjectMapper();
        JsonNode data = json.readTree("""
            {"orderCode":123,"amount":3000,"description":"VQRIO123",
             "accountNumber":"12345678","reference":"TF230204212323",
             "transactionDateTime":"2023-02-04 18:25:00","currency":"VND",
             "paymentLinkId":"124c33293c43417ab7879e14c8d9eb18",
             "code":"00","desc":"Thành công",
             "counterAccountBankId":"","counterAccountBankName":"",
             "counterAccountName":"","counterAccountNumber":"",
             "virtualAccountName":"","virtualAccountNumber":""}
            """);
        String signature = "412e915d2871504ed31be63c8f62a149a4410d34c4c42affc9006ef9917eaa03";
        assertTrue(client.verifyWebhook(data, signature));
        ((com.fasterxml.jackson.databind.node.ObjectNode) data).put("amount", 3001);
        assertFalse(client.verifyWebhook(data, signature));
    }
}
