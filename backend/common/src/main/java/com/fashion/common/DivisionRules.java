package com.fashion.common;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.InputStream;
import java.util.HashSet;
import java.util.Set;

public final class DivisionRules {
    private static final Set<String> PAIRS = load();
    private DivisionRules() {}

    public static boolean valid(String province, String ward) {
        return province != null && ward != null && PAIRS.contains(province + "\u0000" + ward);
    }

    private static Set<String> load() {
        try (InputStream input = DivisionRules.class.getResourceAsStream("/vietnamDivisions.json")) {
            if (input == null) throw new IllegalStateException("Missing province and ward data");
            Set<String> pairs = new HashSet<>();
            for (JsonNode province : new ObjectMapper().readTree(input)) {
                for (JsonNode ward : province.path("wards")) {
                    pairs.add(province.path("name").asText() + "\u0000" + ward.path("name").asText());
                }
            }
            return Set.copyOf(pairs);
        } catch (java.io.IOException error) {
            throw new IllegalStateException("Cannot read province and ward data", error);
        }
    }
}
