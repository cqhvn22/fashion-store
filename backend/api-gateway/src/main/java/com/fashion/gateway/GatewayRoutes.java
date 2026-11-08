package com.fashion.gateway;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Locale;
import java.util.Set;

import org.eclipse.microprofile.config.inject.ConfigProperty;

import io.quarkus.vertx.web.Body;
import io.quarkus.vertx.web.Route;
import io.quarkus.vertx.web.Route.HttpMethod;
import io.vertx.core.buffer.Buffer;
import io.vertx.ext.web.RoutingContext;
import jakarta.enterprise.context.ApplicationScoped;

@ApplicationScoped
public class GatewayRoutes {
    private static final Set<String> HOP_HEADERS = Set.of(
            "connection", "content-length", "expect", "host", "keep-alive",
            "proxy-authenticate", "proxy-authorization", "te",
            "trailer", "transfer-encoding", "upgrade");

    private final HttpClient client = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();

    @ConfigProperty(name = "gateway.auth.url")
    String authUrl;

    @ConfigProperty(name = "gateway.catalog.url")
    String catalogUrl;

    @ConfigProperty(name = "gateway.order.url")
    String orderUrl;

    @ConfigProperty(name = "gateway.ai.url")
    String aiUrl;

    @Route(regex = "^/api/v1/.*",
            methods = {HttpMethod.GET, HttpMethod.POST, HttpMethod.PUT,
                    HttpMethod.PATCH, HttpMethod.DELETE},
            type = Route.HandlerType.BLOCKING)
    void forward(RoutingContext context, @Body Buffer body) {
        String base = targetFor(context.request().path());
        if (base == null) {
            context.response().setStatusCode(404).end();
            return;
        }

        String origin = base.endsWith("/") ? base.substring(0, base.length() - 1) : base;
        try {
            HttpRequest.Builder request = HttpRequest.newBuilder(URI.create(origin + context.request().uri()))
                    .timeout(Duration.ofSeconds(12));
            context.request().headers().forEach(header -> {
                if (!HOP_HEADERS.contains(header.getKey().toLowerCase(Locale.ROOT))) {
                    request.header(header.getKey(), header.getValue());
                }
            });
            request.method(context.request().method().name(),
                    body == null ? HttpRequest.BodyPublishers.noBody()
                            : HttpRequest.BodyPublishers.ofByteArray(body.getBytes()));

            HttpResponse<byte[]> upstream = client.send(
                    request.build(), HttpResponse.BodyHandlers.ofByteArray());
            context.response().setStatusCode(upstream.statusCode());
            upstream.headers().map().forEach((name, values) -> {
                if (!HOP_HEADERS.contains(name.toLowerCase(Locale.ROOT))) {
                    values.forEach(value -> context.response().headers().add(name, value));
                }
            });
            context.response().end(Buffer.buffer(upstream.body()));
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
            context.response().setStatusCode(502).end("Upstream request interrupted");
        } catch (IOException | IllegalArgumentException error) {
            context.response().setStatusCode(502).end("Upstream unavailable");
        }
    }

    private String targetFor(String path) {
        if (matches(path, "/api/v1/auth") || matches(path, "/api/v1/users")
                || matches(path, "/api/v1/admin/users")) {
            return authUrl;
        }
        if (matches(path, "/api/v1/products") || matches(path, "/api/v1/categories")
                || matches(path, "/api/v1/wishlist")
                || matches(path, "/api/v1/admin/products")
                || matches(path, "/api/v1/admin/categories")
                || matches(path, "/api/v1/admin/inventory")) {
            return catalogUrl;
        }
        if (matches(path, "/api/v1/cart") || matches(path, "/api/v1/orders")
                || matches(path, "/api/v1/admin/orders")
                || matches(path, "/api/v1/admin/statistics")) {
            return orderUrl;
        }
        if (matches(path, "/api/v1/chat")
                || matches(path, "/api/v1/admin/knowledge")
                || matches(path, "/api/v1/admin/ai-conversations")) {
            return aiUrl;
        }
        return null;
    }

    private boolean matches(String path, String prefix) {
        return path.equals(prefix) || path.startsWith(prefix + "/");
    }
}
