package com.fashion.catalog;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.Test;

class PublicCatalogCacheTest {
    @Test
    void reusesResultUntilInvalidatedOrExpired() {
        AtomicLong now = new AtomicLong();
        AtomicInteger loads = new AtomicInteger();
        PublicCatalogCache cache = new PublicCatalogCache(30, now::get);
        var loader = (java.util.function.Supplier<List<Map<String, Object>>>) () ->
                List.of(Map.of("version", loads.incrementAndGet()));

        assertEquals(1, cache.get(PublicCatalogCache.CATEGORIES, loader).getFirst().get("version"));
        assertEquals(1, cache.get(PublicCatalogCache.CATEGORIES, loader).getFirst().get("version"));
        assertEquals(1, loads.get());

        cache.invalidate(PublicCatalogCache.CATEGORIES);
        assertEquals(2, cache.get(PublicCatalogCache.CATEGORIES, loader).getFirst().get("version"));

        now.set(30);
        assertEquals(3, cache.get(PublicCatalogCache.CATEGORIES, loader).getFirst().get("version"));
    }

    @Test
    void failedLoadDoesNotReplacePreviousValue() {
        AtomicLong now = new AtomicLong();
        PublicCatalogCache cache = new PublicCatalogCache(30, now::get);
        cache.get(PublicCatalogCache.BANNERS, () -> List.of(Map.of("id", "banner")));
        now.set(31);
        assertThrows(IllegalStateException.class,
                () -> cache.get(PublicCatalogCache.BANNERS, () -> { throw new IllegalStateException(); }));
        now.set(10);
        assertEquals("banner", cache.get(PublicCatalogCache.BANNERS, List::of).getFirst().get("id"));
    }
}
