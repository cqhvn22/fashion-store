package com.fashion.auth;

import com.fashion.common.Api;
import com.fashion.common.Sql;
import jakarta.annotation.security.RolesAllowed;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import java.util.Map;
import javax.sql.DataSource;

@Path("/api/v1/admin/users")
@RolesAllowed("ADMIN")
@Produces(MediaType.APPLICATION_JSON)
public class AdminUserResource {
    @Inject DataSource database;

    @GET
    public Map<String, Object> list() {
        return Api.ok(Sql.list(database,
                "SELECT id,email,full_name,phone,avatar_url,role,status,created_at FROM users ORDER BY created_at DESC LIMIT 500"));
    }
}
