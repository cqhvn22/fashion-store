package com.fashion.auth;

import com.fashion.common.Api;
import com.fashion.common.Sql;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.security.RolesAllowed;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import org.eclipse.microprofile.jwt.JsonWebToken;

import javax.sql.DataSource;
import java.net.URI;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Path("/api/v1/admin/email")
@Consumes(MediaType.APPLICATION_JSON)
@Produces(MediaType.APPLICATION_JSON)
@RolesAllowed("ADMIN")
public class EmailCampaignResource {
    private static final String AUDIENCE = """
        FROM newsletter_subscriptions n
        LEFT JOIN users u ON lower(u.email)=n.email
        WHERE n.unsubscribed_at IS NULL AND (u.id IS NULL OR (u.role='USER' AND u.status='ACTIVE'))
          AND CASE ? WHEN 'REGISTERED' THEN u.id IS NOT NULL
                     WHEN 'NEWSLETTER' THEN u.id IS NULL
                     ELSE true END
        """;
    @Inject DataSource database;
    @Inject JsonWebToken jwt;
    @Inject ObjectMapper json;
    @Inject ResendMail mail;

    public record Content(String subject, String preheader, String title, String body, String imageUrl,
                          String imageAlt, String buttonText, String buttonUrl) {}
    public record Campaign(UUID id, Content content, String group, List<String> emails) {}

    @GET @Path("/recipients")
    public Map<String, Object> recipients(@QueryParam("group") String group, @QueryParam("q") String search,
            @DefaultValue("1") @QueryParam("page") int page) {
        validateGroup(group);
        Api.require(page >= 1 && page <= 100_000, 400, "INVALID_PAGE", "Trang không hợp lệ");
        String query = search == null ? "" : search.trim().toLowerCase(Locale.ROOT);
        Api.require(query.length() <= 255, 400, "INVALID_SEARCH", "Từ khóa quá dài");
        String match = " AND (?='' OR strpos(n.email,?)>0 OR strpos(lower(u.full_name),?)>0)";
        var items = Sql.list(database, "SELECT n.email,u.full_name,CASE WHEN u.id IS NULL THEN 'NEWSLETTER' "
                + "ELSE 'REGISTERED' END AS audience " + AUDIENCE + match + " ORDER BY n.email LIMIT 50 OFFSET ?",
                group, query, query, query, (page - 1) * 50);
        var counts = Sql.one(database, "SELECT count(*) FILTER (WHERE u.id IS NOT NULL) AS registered,"
                + "count(*) FILTER (WHERE u.id IS NULL) AS newsletter " + AUDIENCE, "ALL");
        var count = Sql.one(database, "SELECT count(*) AS total " + AUDIENCE + match, group, query, query, query);
        return Api.ok(Map.of("items", items, "counts", counts, "total", count.get("total"), "configured", mail.configured()));
    }

    @POST @Path("/campaigns")
    public Map<String, Object> enqueue(Campaign request) throws java.sql.SQLException, java.io.IOException {
        mail.requireConfigured();
        Api.require(request != null && request.id() != null && request.content() != null, 400,
                "INVALID_CAMPAIGN", "Thiếu thông tin chiến dịch");
        Content content = request.content();
        validateContent(content);
        validateGroup(request.group());
        List<String> selected = request.emails();
        Api.require(selected == null || (!selected.isEmpty() && selected.size() <= 1000
                && selected.stream().allMatch(InputRules::email)), 400, "INVALID_RECIPIENTS", "Chọn từ 1 đến 1.000 email");
        UUID author = UUID.fromString(jwt.getSubject());
        try (var connection = database.getConnection()) {
            connection.setAutoCommit(false);
            int inserted = Sql.update(connection, "INSERT INTO email_campaigns(id,created_by,subject,content) "
                    + "VALUES (?,?,?,CAST(? AS jsonb)) ON CONFLICT(id) DO NOTHING",
                    request.id(), author, content.subject().trim(), json.writeValueAsString(content));
            if (inserted == 0) {
                Api.require(Sql.one(connection, "SELECT id FROM email_campaigns WHERE id=? AND created_by=?",
                        request.id(), author) != null, 409, "CAMPAIGN_EXISTS", "Chiến dịch đã tồn tại");
                return Api.ok(Map.of("id", request.id()));
            }
            String onlySelected = selected == null ? "" : " AND n.email IN (SELECT jsonb_array_elements_text(CAST(? AS jsonb)))";
            String insert = "INSERT INTO email_campaign_recipients(id,campaign_id,email) "
                    + "SELECT gen_random_uuid(),?,n.email " + AUDIENCE + onlySelected;
            int count = selected == null ? Sql.update(connection, insert, request.id(), request.group())
                    : Sql.update(connection, insert, request.id(), request.group(), json.writeValueAsString(selected.stream()
                        .map(email -> email.trim().toLowerCase(Locale.ROOT)).distinct().toList()));
            Api.require(count > 0, 400, "NO_RECIPIENTS", "Chưa có người nhận email đủ điều kiện");
            connection.commit();
            return Api.ok(Map.of("id", request.id(), "recipients", count));
        }
    }

    @GET @Path("/campaigns")
    public Map<String, Object> campaigns() {
        return Api.ok(Sql.list(database, """
            SELECT c.id,c.subject,c.created_at,count(r.id) AS total,
                count(*) FILTER (WHERE r.status IN ('QUEUED','SENDING')) AS pending,
                count(*) FILTER (WHERE r.status='ACCEPTED') AS accepted,
                count(*) FILTER (WHERE r.status='FAILED') AS failed,
                count(*) FILTER (WHERE r.status='SKIPPED') AS skipped,
                max(r.last_error) FILTER (WHERE r.status='FAILED') AS last_error
            FROM (SELECT id,subject,created_at FROM email_campaigns ORDER BY created_at DESC LIMIT 30) c
            LEFT JOIN email_campaign_recipients r ON r.campaign_id=c.id
            GROUP BY c.id,c.subject,c.created_at ORDER BY c.created_at DESC,id
            """));
    }

    private void validateGroup(String group) {
        Api.require("ALL".equals(group) || "REGISTERED".equals(group) || "NEWSLETTER".equals(group),
                400, "INVALID_GROUP", "Nhóm người nhận không hợp lệ");
    }

    private void validateContent(Content content) {
        Api.require(InputRules.text(content.subject(), 150) && !content.subject().matches("(?s).*[\\r\\n].*")
                && InputRules.text(content.title(), 120) && InputRules.text(content.body(), 8000)
                && (blank(content.preheader()) || InputRules.text(content.preheader(), 160))
                && (blank(content.imageUrl()) || (isHttps(content.imageUrl()) && InputRules.text(content.imageAlt(), 150)))
                && ((blank(content.buttonText()) && blank(content.buttonUrl()))
                || (InputRules.text(content.buttonText(), 50) && isHttps(content.buttonUrl()))),
                400, "INVALID_CONTENT", "Kiểm tra tiêu đề, nội dung, ảnh và đường dẫn HTTPS của email.");
    }

    static boolean blank(String value) {
        return value == null || value.isBlank();
    }

    private boolean isHttps(String value) {
        if (!InputRules.text(value, 2048)) return false;
        try {
            var uri = URI.create(value.trim());
            return "https".equalsIgnoreCase(uri.getScheme()) && uri.getHost() != null && uri.getUserInfo() == null;
        } catch (IllegalArgumentException error) {
            return false;
        }
    }
}
