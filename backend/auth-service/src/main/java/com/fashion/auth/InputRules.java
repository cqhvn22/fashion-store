package com.fashion.auth;

import com.fashion.common.Api;

final class InputRules {
    private InputRules() {}

    static boolean text(String value, int max) {
        return value != null && !value.isBlank() && value.trim().length() <= max;
    }

    static boolean email(String value) {
        return text(value, 255) && value.trim().matches("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");
    }

    static boolean phone(String value) {
        return value == null || value.isBlank() || value.matches("0[0-9]{9}");
    }

    static void password(String value) {
        Api.require(value != null && value.length() >= 8
                && value.getBytes(java.nio.charset.StandardCharsets.UTF_8).length <= 72
                && value.matches(".*[A-Za-z].*") && value.matches(".*[0-9].*"),
                400, "INVALID_PASSWORD", "Mật khẩu cần 8–72 ký tự, có chữ và số");
    }
}
