package com.fashion.catalog;

import jakarta.enterprise.context.ApplicationScoped;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

@ApplicationScoped
public class AiIndexNotifier {
    private static final Logger LOG = Logger.getLogger(AiIndexNotifier.class);
    private final HttpClient client = HttpClient.newHttpClient();
    @ConfigProperty(name = "ai.service.url") String aiUrl;
    @ConfigProperty(name = "internal.api.key") String internalKey;

    public void productChanged() {
        HttpRequest request = HttpRequest.newBuilder(URI.create(aiUrl + "/api/v1/internal/ai/reindex"))
                .timeout(Duration.ofSeconds(3))
                .header("X-Internal-Key", internalKey)
                .POST(HttpRequest.BodyPublishers.noBody()).build();
        client.sendAsync(request, HttpResponse.BodyHandlers.discarding())
                .thenAccept(response -> {
                    if (response.statusCode() != 202)
                        LOG.warnf("AI index refresh returned HTTP %d", response.statusCode());
                })
                .exceptionally(error -> {
                    LOG.warn("AI index refresh unavailable; periodic sync will retry", error);
                    return null;
                });
    }
}
