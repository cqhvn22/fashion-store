package com.fashion.common;

import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Response;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class Api {
    private Api() {}

    public static Map<String, Object> ok(Object data) {
        return Map.of("success", true, "data", data, "timestamp", Instant.now().toString());
    }

    public static Map<String, Object> page(List<?> content, int page, int size, long total) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("content", content);
        result.put("page", page);
        result.put("size", size);
        result.put("totalElements", total);
        result.put("totalPages", (total + size - 1) / size);
        result.put("last", (long) page * size >= total);
        return ok(result);
    }

    public static WebApplicationException error(int status, String code, String message) {
        return new WebApplicationException(Response.status(status)
                .entity(Map.of("success", false, "code", code, "message", message))
                .build());
    }

    public static void require(boolean condition, int status, String code, String message) {
        if (!condition) throw error(status, code, message);
    }
}
