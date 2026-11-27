package com.fashion.order;

import com.fashion.common.Api;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import java.util.Map;

@Path("/api/v1/payments/payos/webhook")
@Consumes(MediaType.APPLICATION_JSON)
@Produces(MediaType.APPLICATION_JSON)
public class PaymentResource {
    @Inject PayosClient payos;
    @Inject PaymentSettlement settlement;

    @POST
    public Map<String, Object> webhook(JsonNode body) {
        Api.require(body != null && payos.verifyWebhook(body.path("data"),
                body.path("signature").asText(null)), 401, "INVALID_SIGNATURE", "Chữ ký PayOS không hợp lệ");
        if (!body.path("success").asBoolean() || !"00".equals(body.path("code").asText())
                || !"00".equals(body.path("data").path("code").asText())) {
            return Api.ok(Map.of("accepted", true));
        }
        JsonNode data = body.path("data");
        settlement.confirmPaid(data.path("orderCode").asLong(-1),
                data.path("amount").asLong(-1), data.path("paymentLinkId").asText(),
                "PAYOS_WEBHOOK", body);
        return Api.ok(Map.of("accepted", true));
    }
}
