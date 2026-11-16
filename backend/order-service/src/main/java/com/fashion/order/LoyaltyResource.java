package com.fashion.order;

import com.fashion.common.Api;
import com.fashion.common.Sql;
import jakarta.annotation.security.RolesAllowed;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import javax.sql.DataSource;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.eclipse.microprofile.jwt.JsonWebToken;

@Path("/api/v1")
@Consumes(MediaType.APPLICATION_JSON)
@Produces(MediaType.APPLICATION_JSON)
public class LoyaltyResource {
    @Inject DataSource database;
    @Inject JsonWebToken jwt;
    @ConfigProperty(name = "internal.api.key") String internalKey;

    public record Settings(long vndPerPoint, int windowMonths) {}
    public record TierRule(int minOrders, long minSpend) {}
    public record TierPromotionInput(String name, String eligibleTier, String discountType,
            Long discountValue, Long minSubtotal, Instant startsAt, Instant endsAt, Boolean isEnabled) {}
    public record Discount(UUID promotionId, long amount) {}

    @GET @Path("/loyalty/me") @RolesAllowed({"USER", "ADMIN"})
    public Map<String, Object> mine() { return Api.ok(summary(UUID.fromString(jwt.getSubject()))); }

    @GET @Path("/loyalty/quote") @RolesAllowed({"USER", "ADMIN"})
    public Map<String, Object> quote(@QueryParam("subtotal") long subtotal) {
        Api.require(subtotal >= 0 && subtotal <= 1_000_000_000L, 400,
                "INVALID_SUBTOTAL", "Tạm tính không hợp lệ");
        Discount discount = bestDiscount(UUID.fromString(jwt.getSubject()), subtotal);
        return Api.ok(Map.of("discountAmount", discount == null ? 0 : discount.amount()));
    }

    @GET @Path("/internal/loyalty/{userId}")
    public Map<String, Object> internal(@PathParam("userId") UUID userId,
            @HeaderParam("X-Internal-Key") String provided) {
        Api.require(provided != null && MessageDigest.isEqual(
                provided.getBytes(StandardCharsets.UTF_8), internalKey.getBytes(StandardCharsets.UTF_8)),
                403, "FORBIDDEN", "Không có quyền truy cập");
        return Api.ok(summary(userId));
    }

    public Map<String, Object> summary(UUID userId) {
        Map<String, Object> settings = Sql.one(database,
                "SELECT vnd_per_point,window_months FROM loyalty_settings WHERE id=true");
        int months = ((Number) settings.get("windowMonths")).intValue();
        Map<String, Object> activity = Sql.one(database,
                "SELECT count(*) AS order_count,coalesce(sum(eligible_amount),0) AS spent "
                + "FROM loyalty_points WHERE user_id=? AND earned_at>=now()-(? * interval '1 month')",
                userId, months);
        long orders = ((Number) activity.get("orderCount")).longValue();
        long spent = ((Number) activity.get("spent")).longValue();
        List<Map<String, Object>> tiers = Sql.list(database,
                "SELECT code,rank,min_orders,min_spend FROM loyalty_tiers ORDER BY rank DESC");
        String tier = "MEMBER";
        for (Map<String, Object> rule : tiers) {
            if (orders >= ((Number) rule.get("minOrders")).longValue()
                    || spent >= ((Number) rule.get("minSpend")).longValue()) {
                tier = (String) rule.get("code");
                break;
            }
        }
        Map<String, Object> points = Sql.one(database,
                "SELECT coalesce(sum(points),0) AS balance FROM loyalty_points WHERE user_id=?", userId);
        List<Map<String, Object>> offers = Sql.list(database,
                "SELECT name,discount_type,discount_value,min_subtotal,ends_at FROM tier_promotions "
                + "WHERE is_enabled AND starts_at<=now() AND ends_at>now() "
                + "AND eligible_tier IN ('ALL',?) ORDER BY ends_at LIMIT 10", tier);
        return Map.of("tier", tier, "points", ((Number) points.get("balance")).longValue(),
                "orderCount", orders, "spent", spent, "windowMonths", months,
                "vndPerPoint", ((Number) settings.get("vndPerPoint")).longValue(), "offers", offers);
    }

    public void award(Connection connection, UUID orderId) throws SQLException {
        Sql.update(connection,
                "INSERT INTO loyalty_points(order_id,user_id,eligible_amount,points) "
                + "SELECT o.id,o.user_id,greatest(0,o.subtotal-o.discount_amount),"
                + "floor(greatest(0,o.subtotal-o.discount_amount)::numeric/s.vnd_per_point)::bigint "
                + "FROM orders o CROSS JOIN loyalty_settings s WHERE s.id=true AND o.id=? "
                + "AND o.status='DELIVERED' AND o.payment_status='PAID' "
                + "ON CONFLICT (order_id) DO NOTHING", orderId);
    }

    public Discount bestDiscount(UUID userId, long subtotal) {
        String tier = (String) summary(userId).get("tier");
        List<Map<String, Object>> rows = Sql.list(database,
                "SELECT id,discount_type,discount_value FROM tier_promotions "
                + "WHERE is_enabled AND starts_at<=now() AND ends_at>now() "
                + "AND min_subtotal<=? AND eligible_tier IN ('ALL',?)", subtotal, tier);
        Discount best = null;
        for (Map<String, Object> row : rows) {
            long value = ((Number) row.get("discountValue")).longValue();
            long discount = "PERCENT".equals(row.get("discountType"))
                    ? subtotal * value / 100 : value;
            discount = Math.max(0, Math.min(Math.max(0, subtotal - 1000), discount));
            if (discount > 0 && (best == null || discount > best.amount()))
                best = new Discount((UUID) row.get("id"), discount);
        }
        return best;
    }

    @GET @Path("/admin/loyalty/settings") @RolesAllowed("ADMIN")
    public Map<String, Object> settings() {
        return Api.ok(Map.of("settings", Sql.one(database,
                "SELECT vnd_per_point,window_months FROM loyalty_settings WHERE id=true"),
                "tiers", Sql.list(database,
                "SELECT code,rank,min_orders,min_spend FROM loyalty_tiers ORDER BY rank")));
    }

    @PUT @Path("/admin/loyalty/settings") @RolesAllowed("ADMIN")
    public Map<String, Object> updateSettings(Settings input) {
        Api.require(input != null && input.vndPerPoint() >= 100 && input.vndPerPoint() <= 1000000
                && input.windowMonths() >= 1 && input.windowMonths() <= 36,
                400, "INVALID_LOYALTY_SETTINGS", "Cấu hình tích điểm không hợp lệ");
        Sql.update(database,
                "UPDATE loyalty_settings SET vnd_per_point=?,window_months=?,updated_at=now() WHERE id=true",
                input.vndPerPoint(), input.windowMonths());
        return settings();
    }

    @PUT @Path("/admin/loyalty/tiers/{code}") @RolesAllowed("ADMIN")
    public Map<String, Object> updateTier(@PathParam("code") String code, TierRule input) {
        Api.require(List.of("SILVER", "GOLD", "DIAMOND").contains(code)
                && input != null && input.minOrders() >= 1 && input.minSpend() >= 1000,
                400, "INVALID_TIER", "Mốc hạng không hợp lệ");
        List<Map<String, Object>> current = Sql.list(database,
                "SELECT code,rank,min_orders,min_spend FROM loyalty_tiers ORDER BY rank");
        int rank = current.stream().filter(row -> code.equals(row.get("code")))
                .mapToInt(row -> ((Number) row.get("rank")).intValue()).findFirst().orElse(-1);
        Api.require(current.stream().allMatch(row -> {
            int otherRank = ((Number) row.get("rank")).intValue();
            long otherOrders = ((Number) row.get("minOrders")).longValue();
            long otherSpend = ((Number) row.get("minSpend")).longValue();
            return otherRank == rank || (otherRank < rank
                    ? input.minOrders() > otherOrders && input.minSpend() > otherSpend
                    : input.minOrders() < otherOrders && input.minSpend() < otherSpend);
        }), 400, "INVALID_TIER_ORDER", "Mốc hạng cần tăng dần từ Bạc đến Kim Cương");
        Sql.update(database, "UPDATE loyalty_tiers SET min_orders=?,min_spend=? WHERE code=?",
                input.minOrders(), input.minSpend(), code);
        return settings();
    }

    @GET @Path("/admin/tier-promotions") @RolesAllowed("ADMIN")
    public Map<String, Object> promotions() {
        return Api.ok(Sql.list(database,
                "SELECT id,name,eligible_tier,discount_type,discount_value,min_subtotal,"
                + "starts_at,ends_at,is_enabled FROM tier_promotions ORDER BY created_at DESC"));
    }

    @POST @Path("/admin/tier-promotions") @RolesAllowed("ADMIN")
    public Map<String, Object> createPromotion(TierPromotionInput input) {
        validate(input);
        UUID id = UUID.randomUUID();
        Sql.update(database, "INSERT INTO tier_promotions(id,name,eligible_tier,discount_type,"
                + "discount_value,min_subtotal,starts_at,ends_at,is_enabled) VALUES (?,?,?,?,?,?,?,?,?)",
                id, input.name().trim(), input.eligibleTier(), input.discountType(),
                input.discountValue(), input.minSubtotal(), Timestamp.from(input.startsAt()),
                Timestamp.from(input.endsAt()), input.isEnabled());
        return Api.ok(Sql.one(database, "SELECT * FROM tier_promotions WHERE id=?", id));
    }

    @PUT @Path("/admin/tier-promotions/{id}") @RolesAllowed("ADMIN")
    public Map<String, Object> updatePromotion(@PathParam("id") UUID id, TierPromotionInput input) {
        validate(input);
        Api.require(Sql.update(database,
                "UPDATE tier_promotions SET name=?,eligible_tier=?,discount_type=?,discount_value=?,"
                + "min_subtotal=?,starts_at=?,ends_at=?,is_enabled=?,updated_at=now() WHERE id=?",
                input.name().trim(), input.eligibleTier(), input.discountType(), input.discountValue(),
                input.minSubtotal(), Timestamp.from(input.startsAt()), Timestamp.from(input.endsAt()),
                input.isEnabled(), id) == 1, 404, "NOT_FOUND", "Không tìm thấy ưu đãi");
        return Api.ok(Sql.one(database, "SELECT * FROM tier_promotions WHERE id=?", id));
    }

    @DELETE @Path("/admin/tier-promotions/{id}") @RolesAllowed("ADMIN")
    public Map<String, Object> deletePromotion(@PathParam("id") UUID id) {
        Api.require(Sql.update(database, "UPDATE tier_promotions SET is_enabled=false,updated_at=now() WHERE id=?", id) == 1,
                404, "NOT_FOUND", "Không tìm thấy ưu đãi");
        return Api.ok(Map.of());
    }

    private void validate(TierPromotionInput input) {
        Api.require(input != null && input.name() != null && !input.name().isBlank()
                && input.name().length() <= 150
                && input.eligibleTier() != null
                && List.of("ALL", "MEMBER", "SILVER", "GOLD", "DIAMOND").contains(input.eligibleTier())
                && input.discountType() != null
                && List.of("PERCENT", "FIXED").contains(input.discountType())
                && input.discountValue() != null && input.discountValue() > 0
                && (!"PERCENT".equals(input.discountType()) || input.discountValue() <= 99)
                && input.minSubtotal() != null && input.minSubtotal() >= 0
                && input.startsAt() != null && input.endsAt() != null
                && input.startsAt().isBefore(input.endsAt()) && input.isEnabled() != null,
                400, "INVALID_TIER_PROMOTION", "Kiểm tra hạng, mức giảm và thời gian áp dụng");
    }
}
