package com.fashion.catalog;

import com.fashion.common.Api;
import com.fashion.common.Sql;
import com.fasterxml.jackson.databind.ObjectMapper;
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
public class HomeCategoryResource {
    @Inject DataSource database;
    @Inject ObjectMapper mapper;

    public record HomeCategoryInput(
        UUID categoryId,
        String title,
        String subtitle,
        String selectionMode,
        List<String> productIds,
        Integer displayLimit,
        Integer sortOrder,
        Boolean isActive
    ) {}

    @GET @Path("/home-categories")
    public Map<String, Object> publicHomeCategories() {
        return Api.ok(list(true));
    }

    @GET @Path("/categories/home-showcases")
    public Map<String, Object> publicCategoriesShowcases() {
        return Api.ok(list(true));
    }

    @GET @Path("/admin/home-categories")
    @RolesAllowed("ADMIN")
    public Map<String, Object> adminHomeCategories() {
        return Api.ok(list(false));
    }

    @GET @Path("/admin/categories/home-showcases")
    @RolesAllowed("ADMIN")
    public Map<String, Object> adminCategoriesShowcases() {
        return Api.ok(list(false));
    }

    @POST @Path("/admin/home-categories")
    @RolesAllowed("ADMIN")
    public Map<String, Object> create(HomeCategoryInput input) {
        validate(input);
        UUID id = UUID.randomUUID();
        String mode = "CUSTOM".equalsIgnoreCase(input.selectionMode()) ? "CUSTOM" : "ALL";
        String productIdsJson = toJson(input.productIds());
        int limit = input.displayLimit() == null || input.displayLimit() <= 0 ? 8 : Math.min(input.displayLimit(), 24);
        int sort = input.sortOrder() == null ? 0 : input.sortOrder();
        boolean active = input.isActive() == null || input.isActive();

        Sql.update(database,
                "INSERT INTO home_categories(id,category_id,title,subtitle,selection_mode,product_ids,display_limit,sort_order,is_active) VALUES (?,?,?,?,?,?,?,?,?)",
                id, input.categoryId(), input.title().trim(), blank(input.subtitle()), mode, productIdsJson, limit, sort, active);
        return Api.ok(one(id));
    }

    @POST @Path("/admin/categories/home-showcases")
    @RolesAllowed("ADMIN")
    public Map<String, Object> createAlt(HomeCategoryInput input) {
        return create(input);
    }

    @PUT @Path("/admin/home-categories/{id}")
    @RolesAllowed("ADMIN")
    public Map<String, Object> update(@PathParam("id") UUID id, HomeCategoryInput input) {
        validate(input);
        String mode = "CUSTOM".equalsIgnoreCase(input.selectionMode()) ? "CUSTOM" : "ALL";
        String productIdsJson = toJson(input.productIds());
        int limit = input.displayLimit() == null || input.displayLimit() <= 0 ? 8 : Math.min(input.displayLimit(), 24);
        int sort = input.sortOrder() == null ? 0 : input.sortOrder();
        boolean active = input.isActive() == null || input.isActive();

        int updated = Sql.update(database,
                "UPDATE home_categories SET category_id=?,title=?,subtitle=?,selection_mode=?,product_ids=?,display_limit=?,sort_order=?,is_active=?,updated_at=now() WHERE id=?",
                input.categoryId(), input.title().trim(), blank(input.subtitle()), mode, productIdsJson, limit, sort, active, id);
        Api.require(updated == 1, 404, "NOT_FOUND", "Không tìm thấy cấu hình danh mục trang chủ");
        return Api.ok(one(id));
    }

    @PUT @Path("/admin/categories/home-showcases/{id}")
    @RolesAllowed("ADMIN")
    public Map<String, Object> updateAlt(@PathParam("id") UUID id, HomeCategoryInput input) {
        return update(id, input);
    }

    @DELETE @Path("/admin/home-categories/{id}")
    @RolesAllowed("ADMIN")
    public Map<String, Object> delete(@PathParam("id") UUID id) {
        Api.require(Sql.update(database, "DELETE FROM home_categories WHERE id=?", id) == 1,
                404, "NOT_FOUND", "Không tìm thấy cấu hình danh mục trang chủ");
        return Api.ok(Map.of("success", true));
    }

    @DELETE @Path("/admin/categories/home-showcases/{id}")
    @RolesAllowed("ADMIN")
    public Map<String, Object> deleteAlt(@PathParam("id") UUID id) {
        return delete(id);
    }

    private List<Map<String, Object>> list(boolean activeOnly) {
        String sql = """
            SELECT hc.id, hc.category_id, hc.title, hc.subtitle, hc.selection_mode,
                   hc.product_ids, hc.display_limit, hc.sort_order, hc.is_active,
                   c.name AS category_name, c.slug AS category_slug
            FROM home_categories hc
            JOIN categories c ON hc.category_id = c.id
            """ + (activeOnly ? " WHERE hc.is_active=true AND c.is_active=true" : "")
            + " ORDER BY hc.sort_order, hc.created_at";
        List<Map<String, Object>> rows = Sql.list(database, sql);
        for (Map<String, Object> row : rows) {
            row.put("productIds", parseProductIds(row.get("productIds")));
            row.put("category", Map.of(
                "id", row.get("categoryId"),
                "name", row.get("categoryName") != null ? row.get("categoryName") : "",
                "slug", row.get("categorySlug") != null ? row.get("categorySlug") : ""
            ));
        }
        return rows;
    }

    private Map<String, Object> one(UUID id) {
        String sql = """
            SELECT hc.id, hc.category_id, hc.title, hc.subtitle, hc.selection_mode,
                   hc.product_ids, hc.display_limit, hc.sort_order, hc.is_active,
                   c.name AS category_name, c.slug AS category_slug
            FROM home_categories hc
            JOIN categories c ON hc.category_id = c.id
            WHERE hc.id = ?
            """;
        Map<String, Object> row = Sql.one(database, sql, id);
        if (row != null) {
            row.put("productIds", parseProductIds(row.get("productIds")));
            row.put("category", Map.of(
                "id", row.get("categoryId"),
                "name", row.get("categoryName") != null ? row.get("categoryName") : "",
                "slug", row.get("categorySlug") != null ? row.get("categorySlug") : ""
            ));
        }
        return row;
    }

    private void validate(HomeCategoryInput input) {
        Api.require(input != null, 400, "INVALID_INPUT", "Dữ liệu không được để trống");
        Api.require(input.categoryId() != null, 400, "MISSING_CATEGORY", "Vui lòng chọn danh mục");
        Api.require(input.title() != null && input.title().trim().length() >= 2 && input.title().trim().length() <= 150,
                400, "INVALID_TITLE", "Tiêu đề từ 2 đến 150 ký tự");
        Api.require(Sql.one(database, "SELECT id FROM categories WHERE id=?", input.categoryId()) != null,
                404, "CATEGORY_NOT_FOUND", "Danh mục không tồn tại");
    }

    private String toJson(List<String> list) {
        if (list == null || list.isEmpty()) return "[]";
        try {
            return mapper.writeValueAsString(list);
        } catch (Exception e) {
            return "[]";
        }
    }

    @SuppressWarnings("unchecked")
    private List<String> parseProductIds(Object val) {
        if (val == null) return List.of();
        if (val instanceof List<?> l) return (List<String>) l;
        String s = val.toString().trim();
        if (s.isEmpty() || s.equals("[]")) return List.of();
        try {
            return mapper.readValue(s, mapper.getTypeFactory().constructCollectionType(List.class, String.class));
        } catch (Exception e) {
            return List.of();
        }
    }

    private static String blank(String s) {
        return s == null ? "" : s.trim();
    }
}
