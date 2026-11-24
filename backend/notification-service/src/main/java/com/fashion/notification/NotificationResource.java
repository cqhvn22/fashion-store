package com.fashion.notification;

import com.fashion.common.Api;
import com.fashion.common.Sql;
import jakarta.annotation.security.RolesAllowed;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.PATCH;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import java.util.Map;
import java.util.UUID;
import javax.sql.DataSource;
import org.eclipse.microprofile.jwt.JsonWebToken;

@Path("/api/v1/notifications")
@RolesAllowed({"USER", "ADMIN"})
@Produces(MediaType.APPLICATION_JSON)
public class NotificationResource {
    @Inject DataSource database;
    @Inject JsonWebToken jwt;

    @GET
    public Map<String, Object> list() {
        return Api.ok(Sql.list(database,
                "SELECT id,order_id,subject,body,read_at,created_at FROM notifications "
                + "WHERE recipient_user_id=? AND channel='IN_APP' ORDER BY created_at DESC LIMIT 50",
                userId()));
    }

    @GET @Path("/unread-count")
    public Map<String, Object> unreadCount() {
        return Api.ok(Sql.one(database,
                "SELECT COUNT(DISTINCT COALESCE(order_id::text, id::text)) AS count FROM notifications WHERE recipient_user_id=? AND channel='IN_APP' AND read_at IS NULL",
                userId()));
    }

    @PATCH @Path("/{id}/read")
    public Map<String, Object> markRead(@PathParam("id") UUID id) {
        Api.require(Sql.update(database,
                "UPDATE notifications SET read_at=COALESCE(read_at,now()) "
                + "WHERE recipient_user_id=? AND (id=? OR (order_id IS NOT NULL AND order_id = (SELECT order_id FROM notifications WHERE id=?)))",
                userId(), id, id) >= 1, 404, "NOT_FOUND", "Không tìm thấy thông báo");
        return Api.ok(Map.of());
    }

    @PATCH @Path("/read-all")
    public Map<String, Object> markAllRead() {
        Sql.update(database,
                "UPDATE notifications SET read_at=now() WHERE recipient_user_id=? AND read_at IS NULL",
                userId());
        return Api.ok(Map.of());
    }

    private UUID userId() { return UUID.fromString(jwt.getSubject()); }
}
