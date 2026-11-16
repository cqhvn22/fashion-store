package com.fashion.auth;

import com.fashion.common.Api;
import com.fashion.common.Sql;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.HeaderParam;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Map;
import javax.sql.DataSource;
import org.eclipse.microprofile.config.inject.ConfigProperty;

@Path("/api/v1/internal/admin-users")
@Produces(MediaType.APPLICATION_JSON)
public class InternalUsersResource {
    @Inject DataSource database;
    @ConfigProperty(name = "internal.api.key") String internalKey;

    @GET
    public Map<String, Object> activeAdmins(@HeaderParam("X-Internal-Key") String provided) {
        Api.require(provided != null && MessageDigest.isEqual(
                provided.getBytes(StandardCharsets.UTF_8), internalKey.getBytes(StandardCharsets.UTF_8)),
                403, "FORBIDDEN", "Không có quyền truy cập");
        return Api.ok(Sql.list(database,
                "SELECT id FROM users WHERE role='ADMIN' AND status='ACTIVE'"));
    }
}
