package com.fashion.catalog;

import com.fashion.common.Api;
import com.fashion.common.Sql;
import jakarta.annotation.security.RolesAllowed;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import javax.sql.DataSource;

@Path("/api/v1")
@Consumes(MediaType.APPLICATION_JSON)
@Produces(MediaType.APPLICATION_JSON)
public class BannerResource {
    @Inject DataSource database;

    public record BannerInput(String title, String subtitle, String imageUrl, String linkUrl,
            String buttonLabel, Integer sortOrder, Boolean isActive) {}

    @GET @Path("/banners")
    public Map<String, Object> publicBanners() {
        return Api.ok(list(true));
    }

    @GET @Path("/admin/banners")
    @RolesAllowed("ADMIN")
    public Map<String, Object> adminBanners() {
        return Api.ok(list(false));
    }

    @POST @Path("/admin/banners")
    @RolesAllowed("ADMIN")
    public Map<String, Object> create(BannerInput input) {
        validate(input);
        UUID id = UUID.randomUUID();
        Sql.update(database, "INSERT INTO home_banners(id,title,subtitle,image_url,link_url,button_label,sort_order,is_active) VALUES (?,?,?,?,?,?,?,?)",
                id, input.title().trim(), blank(input.subtitle()), input.imageUrl(), input.linkUrl(),
                input.buttonLabel().trim(), input.sortOrder() == null ? 0 : input.sortOrder(),
                input.isActive() == null || input.isActive());
        return Api.ok(one(id));
    }

    @PUT @Path("/admin/banners/{id}")
    @RolesAllowed("ADMIN")
    public Map<String, Object> update(@PathParam("id") UUID id, BannerInput input) {
        validate(input);
        Api.require(Sql.update(database, "UPDATE home_banners SET title=?,subtitle=?,image_url=?,link_url=?,button_label=?,sort_order=?,is_active=?,updated_at=now() WHERE id=?",
                input.title().trim(), blank(input.subtitle()), input.imageUrl(), input.linkUrl(),
                input.buttonLabel().trim(), input.sortOrder() == null ? 0 : input.sortOrder(),
                input.isActive() == null || input.isActive(), id) == 1, 404, "NOT_FOUND", "Không tìm thấy banner");
        return Api.ok(one(id));
    }

    @DELETE @Path("/admin/banners/{id}")
    @RolesAllowed("ADMIN")
    public Map<String, Object> delete(@PathParam("id") UUID id) {
        Api.require(Sql.update(database, "DELETE FROM home_banners WHERE id=?", id) == 1,
                404, "NOT_FOUND", "Không tìm thấy banner");
        return Api.ok(Map.of());
    }

    private List<Map<String, Object>> list(boolean activeOnly) {
        return Sql.list(database, "SELECT id,title,subtitle,image_url,link_url,button_label,sort_order,is_active FROM home_banners"
                + (activeOnly ? " WHERE is_active=true" : "") + " ORDER BY sort_order,created_at");
    }

    private Map<String, Object> one(UUID id) {
        return Sql.one(database, "SELECT id,title,subtitle,image_url,link_url,button_label,sort_order,is_active FROM home_banners WHERE id=?", id);
    }

    private void validate(BannerInput input) {
        Api.require(input != null && length(input.title(), 150) && input.title().trim().length() >= 2
                && length(input.imageUrl(), 2048)
                && length(input.linkUrl(), 500) && length(input.buttonLabel(), 60)
                && (input.subtitle() == null || input.subtitle().length() <= 400)
                && input.linkUrl().startsWith("/") && !input.linkUrl().startsWith("//")
                && (input.sortOrder() == null || input.sortOrder() >= 0)
                && imageUrl(input.imageUrl()), 400, "INVALID_BANNER", "Thông tin banner không hợp lệ");
    }

    private static boolean length(String s, int max) { return s != null && !s.isBlank() && s.length() <= max; }
    private static boolean imageUrl(String s) { return s.startsWith("/api/v1/media/") || s.matches("https?://[^\\s]+") ; }
    private static String blank(String s) { return s == null ? "" : s.trim(); }
}
