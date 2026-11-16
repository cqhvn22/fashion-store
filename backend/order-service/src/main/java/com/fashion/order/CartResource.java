package com.fashion.order;

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
import org.eclipse.microprofile.jwt.JsonWebToken;

@Path("/api/v1/cart/items")
@RolesAllowed({"USER", "ADMIN"})
@Consumes(MediaType.APPLICATION_JSON)
@Produces(MediaType.APPLICATION_JSON)
public class CartResource {
    @Inject DataSource database;
    @Inject JsonWebToken jwt;

    public record CartItem(UUID productId, UUID variantId, int quantity, Boolean selected) {}

    @GET
    public Map<String, Object> list() {
        return Api.ok(Sql.list(database,
                "SELECT ci.id,ci.product_id,ci.variant_id,ci.quantity,ci.selected FROM cart_items ci JOIN carts c ON c.id=ci.cart_id WHERE c.user_id=? ORDER BY ci.added_at",
                userId()));
    }

    @POST
    public Map<String, Object> add(CartItem input) {
        validate(input);
        UUID cartId = cartId();
        Sql.update(database,
                "INSERT INTO cart_items(id,cart_id,product_id,variant_id,quantity,selected) VALUES (?,?,?,?,?,?) ON CONFLICT (cart_id,variant_id) DO UPDATE SET quantity=cart_items.quantity+excluded.quantity,selected=excluded.selected",
                UUID.randomUUID(), cartId, input.productId(), input.variantId(), input.quantity(),
                input.selected() == null || input.selected());
        return list();
    }

    @PATCH @Path("/{id}")
    public Map<String, Object> update(@PathParam("id") UUID id, CartItem input) {
        Api.require(input != null && input.quantity() > 0, 400,
                "INVALID_QUANTITY", "Số lượng không hợp lệ");
        Api.require(Sql.update(database,
                "UPDATE cart_items SET quantity=?,selected=? WHERE id=? AND cart_id IN (SELECT id FROM carts WHERE user_id=?)",
                input.quantity(), input.selected() == null || input.selected(), id, userId()) == 1,
                404, "NOT_FOUND", "Không tìm thấy món trong giỏ");
        return list();
    }

    @DELETE @Path("/{id}")
    public Map<String, Object> remove(@PathParam("id") UUID id) {
        Sql.update(database,
                "DELETE FROM cart_items WHERE id=? AND cart_id IN (SELECT id FROM carts WHERE user_id=?)",
                id, userId());
        return list();
    }

    private UUID cartId() {
        Map<String, Object> existing = Sql.one(database, "SELECT id FROM carts WHERE user_id=?", userId());
        if (existing != null) return (UUID) existing.get("id");
        UUID id = UUID.randomUUID();
        Sql.update(database,
                "INSERT INTO carts(id,user_id) VALUES (?,?) ON CONFLICT (user_id) DO NOTHING",
                id, userId());
        return (UUID) Sql.one(database, "SELECT id FROM carts WHERE user_id=?", userId()).get("id");
    }

    private UUID userId() { return UUID.fromString(jwt.getSubject()); }
    private void validate(CartItem input) {
        Api.require(input != null && input.productId() != null && input.variantId() != null
                && input.quantity() > 0, 400, "INVALID_ITEM", "Món trong giỏ không hợp lệ");
    }
}
