package com.fashion.auth;

import com.fashion.common.Api;
import com.fashion.common.Sql;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;

import javax.sql.DataSource;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Path("/api/v1/newsletter")
@Produces(MediaType.APPLICATION_JSON)
public class NewsletterResource {
    static final String SUBSCRIBE = """
        INSERT INTO newsletter_subscriptions(email,token) VALUES (?,?)
        ON CONFLICT (email) DO UPDATE SET unsubscribed_at=NULL, subscribed_at=now()
        WHERE newsletter_subscriptions.unsubscribed_at IS NOT NULL
        """;
    @Inject DataSource database;
    public record Subscription(String email) {}

    @POST @Path("/subscribe") @Consumes(MediaType.APPLICATION_JSON)
    public Map<String, Object> subscribe(Subscription request) {
        Api.require(request != null && InputRules.email(request.email()), 400, "INVALID_EMAIL", "Email không hợp lệ");
        Sql.update(database, SUBSCRIBE, request.email().trim().toLowerCase(Locale.ROOT), UUID.randomUUID());
        return Api.ok(Map.of());
    }

    @POST @Path("/unsubscribe/{token}")
    public Map<String, Object> unsubscribe(@PathParam("token") UUID token) {
        Sql.update(database, "UPDATE newsletter_subscriptions SET unsubscribed_at=now() "
                + "WHERE token=? AND unsubscribed_at IS NULL", token);
        return Api.ok(Map.of());
    }
}
