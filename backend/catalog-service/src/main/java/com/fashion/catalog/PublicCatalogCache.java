package com.fashion.catalog;

import jakarta.enterprise.context.ApplicationScoped;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.LongSupplier;
import java.util.function.Supplier;
import java.util.concurrent.TimeUnit;

/** Small, short-lived cache for public catalog metadata only. */
@ApplicationScoped
public class PublicCatalogCache {
    static final String CATEGORIES = "categories";
    static final String BANNERS = "banners";
    static final String HOME_CATEGORIES = "home-categories";

    private record Entry(long loadedAt, List<Map<String, Object>> value) {}

    private final Map<String, Entry> entries = new HashMap<>();
    private final long ttlNanos;
    private final LongSupplier clock;

    public PublicCatalogCache() {
        this(TimeUnit.SECONDS.toNanos(30), System::nanoTime);
    }

    PublicCatalogCache(long ttlNanos, LongSupplier clock) {
        this.ttlNanos = ttlNanos;
        this.clock = clock;
    }

    public synchronized List<Map<String, Object>> get(
            String key, Supplier<List<Map<String, Object>>> loader) {
        long now = clock.getAsLong();
        Entry entry = entries.get(key);
        if (entry != null && now - entry.loadedAt() < ttlNanos) {
            return entry.value();
        }
        List<Map<String, Object>> value = loader.get();
        entries.put(key, new Entry(now, value));
        return value;
    }

    public synchronized void invalidate(String... keys) {
        for (String key : keys) entries.remove(key);
    }
}
