package com.fashion.catalog;

import com.fashion.common.Api;
import com.fashion.common.Sql;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import javax.sql.DataSource;

@ApplicationScoped
public class ReservationResource {
    @Inject DataSource database;

    public record Item(UUID variantId, int quantity) {}
    public record Reserve(UUID checkoutId, List<Item> items, Instant expiresAt) {}

    public List<Map<String, Object>> reserve(Reserve request) {
        Api.require(request != null && request.checkoutId() != null && request.items() != null
                && !request.items().isEmpty() && request.expiresAt() != null
                && request.expiresAt().isAfter(Instant.now()), 400, "INVALID_INPUT", "Yêu cầu giữ tồn không hợp lệ");
        Api.require(request.items().stream().allMatch(item -> item != null && item.variantId() != null
                && item.quantity() > 0) && request.items().stream().map(Item::variantId).distinct().count() == request.items().size(),
                400, "INVALID_ITEM", "Biến thể hoặc số lượng không hợp lệ");
        List<Item> sorted = request.items().stream()
                .sorted(Comparator.comparing(item -> item.variantId().toString())).toList();
        List<Map<String, Object>> snapshots = new ArrayList<>();
        try (Connection connection = database.getConnection()) {
            connection.setAutoCommit(false);
            for (Item item : sorted) {
                Api.require(item.variantId() != null && item.quantity() > 0,
                        400, "INVALID_ITEM", "Biến thể hoặc số lượng không hợp lệ");
                Map<String, Object> variant = Sql.one(connection,
                        "SELECT v.id AS variant_id,v.product_id,p.name AS product_name,p.slug AS product_slug,"
                        + "v.sku,v.size,v.color,COALESCE(v.image_url,(SELECT i.url FROM product_images i "
                        + "WHERE i.product_id=p.id ORDER BY i.is_primary DESC,i.sort_order LIMIT 1)) AS image_url,"
                        + "cp.effective_price AS price,v.stock_quantity,v.reserved_quantity,p.status,v.is_active "
                        + "FROM product_variants v JOIN products p ON p.id=v.product_id "
                        + "JOIN current_variant_prices cp ON cp.variant_id=v.id WHERE v.id=? FOR UPDATE OF v",
                        item.variantId());
                Api.require(variant != null && "ACTIVE".equals(variant.get("status"))
                        && Boolean.TRUE.equals(variant.get("isActive")), 409, "UNAVAILABLE", "Sản phẩm không khả dụng");
                Map<String, Object> existing = Sql.one(connection,
                        "SELECT quantity,status FROM inventory_reservations WHERE checkout_id=? AND variant_id=?",
                        request.checkoutId(), item.variantId());
                if (existing == null) {
                    int available = (int) variant.get("stockQuantity") - (int) variant.get("reservedQuantity");
                    Api.require(available >= item.quantity(), 409, "OUT_OF_STOCK", "Không đủ tồn kho");
                    Sql.update(connection,
                            "UPDATE product_variants SET reserved_quantity=reserved_quantity+?,updated_at=now() WHERE id=?",
                            item.quantity(), item.variantId());
                    Sql.update(connection,
                            "INSERT INTO inventory_reservations(id,checkout_id,variant_id,quantity,expires_at) VALUES (?,?,?,?,?)",
                            UUID.randomUUID(), request.checkoutId(), item.variantId(), item.quantity(),
                            Timestamp.from(request.expiresAt()));
                } else {
                    Api.require("RESERVED".equals(existing.get("status"))
                            && (int) existing.get("quantity") == item.quantity(), 409,
                            "RESERVATION_CONFLICT", "Checkout đã được xử lý với số lượng khác");
                }
                variant.remove("stockQuantity");
                variant.remove("reservedQuantity");
                variant.remove("status");
                variant.remove("isActive");
                variant.put("quantity", item.quantity());
                snapshots.add(variant);
            }
            connection.commit();
            return snapshots;
        } catch (SQLException error) {
            throw new IllegalStateException("Inventory reservation failed", error);
        }
    }

    public void commit(UUID checkoutId) {
        try (Connection connection = database.getConnection()) {
            connection.setAutoCommit(false);
            List<Map<String, Object>> rows = Sql.list(connection,
                    "SELECT id,variant_id,quantity,status FROM inventory_reservations WHERE checkout_id=? ORDER BY variant_id FOR UPDATE",
                    checkoutId);
            Api.require(!rows.isEmpty(), 404, "NOT_FOUND", "Không tìm thấy đặt giữ tồn");
            for (Map<String, Object> row : rows) {
                if ("COMMITTED".equals(row.get("status"))) continue;
                Api.require("RESERVED".equals(row.get("status")), 409, "RESERVATION_RELEASED", "Tồn đã được hoàn");
                UUID variantId = (UUID) row.get("variantId");
                int quantity = (int) row.get("quantity");
                Sql.update(connection,
                        "UPDATE product_variants SET stock_quantity=stock_quantity-?,reserved_quantity=reserved_quantity-?,updated_at=now() WHERE id=?",
                        quantity, quantity, variantId);
                Sql.update(connection, "UPDATE inventory_reservations SET status='COMMITTED',updated_at=now() WHERE id=?",
                        row.get("id"));
                Sql.update(connection,
                        "INSERT INTO inventory_movements(id,variant_id,delta,reason,reference_id) VALUES (?,?,?,'ORDER_COMMIT',?)",
                        UUID.randomUUID(), variantId, -quantity, checkoutId);
            }
            connection.commit();
        } catch (SQLException error) {
            throw new IllegalStateException("Inventory commit failed", error);
        }
    }

    public void release(UUID checkoutId) {
        try (Connection connection = database.getConnection()) {
            connection.setAutoCommit(false);
            List<Map<String, Object>> rows = Sql.list(connection,
                    "SELECT id,variant_id,quantity,status FROM inventory_reservations WHERE checkout_id=? ORDER BY variant_id FOR UPDATE",
                    checkoutId);
            for (Map<String, Object> row : rows) {
                if ("RELEASED".equals(row.get("status"))) continue;
                UUID variantId = (UUID) row.get("variantId");
                int quantity = (int) row.get("quantity");
                if ("COMMITTED".equals(row.get("status"))) {
                    Sql.update(connection,
                            "UPDATE product_variants SET stock_quantity=stock_quantity+?,updated_at=now() WHERE id=?",
                            quantity, variantId);
                    Sql.update(connection,
                            "INSERT INTO inventory_movements(id,variant_id,delta,reason,reference_id) VALUES (?,?,?,'ORDER_CANCEL',?)",
                            UUID.randomUUID(), variantId, quantity, checkoutId);
                } else {
                    Sql.update(connection,
                            "UPDATE product_variants SET reserved_quantity=reserved_quantity-?,updated_at=now() WHERE id=?",
                            quantity, variantId);
                }
                Sql.update(connection, "UPDATE inventory_reservations SET status='RELEASED',updated_at=now() WHERE id=?",
                        row.get("id"));
            }
            connection.commit();
        } catch (SQLException error) {
            throw new IllegalStateException("Inventory release failed", error);
        }
    }

}
