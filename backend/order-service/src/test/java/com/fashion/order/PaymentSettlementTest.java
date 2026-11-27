package com.fashion.order;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.ws.rs.WebApplicationException;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class PaymentSettlementTest {
    @Test
    void onlySettlesFullyPaidMatchingOrder() {
        var settlement = new PaymentSettlement() {
            int calls;
            @Override public void confirmPaid(long code, long amount, String link, String reason, JsonNode body) {
                assertEquals("test-link", link);
                calls++;
            }
        };
        var state = new ObjectMapper().createObjectNode().put("id", "test-link").put("status", "PENDING")
                .put("orderCode", 42).put("amount", 499000).put("amountPaid", 0);
        assertFalse(settlement.confirmProviderState(state, 42, 499000, "TEST"));
        state.put("status", "PAID").put("amountPaid", 498999);
        assertThrows(WebApplicationException.class, () -> settlement.confirmProviderState(state, 42, 499000, "TEST"));
        state.put("amountPaid", 499000);
        assertThrows(WebApplicationException.class, () -> settlement.confirmProviderState(state, 43, 499000, "TEST"));
        assertTrue(settlement.confirmProviderState(state, 42, 499000, "TEST"));
        assertEquals(1, settlement.calls);
    }
}
