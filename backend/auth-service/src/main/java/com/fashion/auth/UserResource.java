package com.fashion.auth;

import com.fashion.common.Api;
import com.fashion.common.Sql;
import com.fashion.common.DivisionRules;
import io.quarkus.elytron.security.common.BcryptUtil;
import jakarta.annotation.security.RolesAllowed;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import java.sql.Connection;
import java.sql.SQLException;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import javax.sql.DataSource;
import org.eclipse.microprofile.jwt.JsonWebToken;

@Path("/api/v1/users/me")
@RolesAllowed({"USER", "ADMIN"})
@Consumes(MediaType.APPLICATION_JSON)
@Produces(MediaType.APPLICATION_JSON)
public class UserResource {
    @Inject DataSource database;
    @Inject JsonWebToken jwt;

    public record Profile(String fullName, String phone, String avatarUrl) {}
    public record PasswordChange(String currentPassword, String newPassword) {}
    public record Address(String recipientName, String phone, String province,
            String district, String ward, String detail, Boolean isDefault) {}

    @GET
    public Map<String, Object> me() {
        return Api.ok(Sql.one(database,
                "SELECT id,email,full_name,phone,avatar_url,role,status,created_at FROM users WHERE id=?",
                userId()));
    }

    @PUT
    public Map<String, Object> update(Profile request) {
        Api.require(request != null && InputRules.text(request.fullName(), 150)
                && InputRules.phone(request.phone())
                && (request.avatarUrl() == null || request.avatarUrl().isBlank()
                    || (request.avatarUrl().length() <= 2048 && request.avatarUrl().matches("https?://[^\\s]+"))),
                400, "INVALID_INPUT", "Tên không hợp lệ");
        Sql.update(database,
                "UPDATE users SET full_name=?,phone=?,avatar_url=?,updated_at=now() WHERE id=?",
                request.fullName().trim(), request.phone(), request.avatarUrl(), userId());
        return me();
    }

    @PUT @Path("/password")
    public Map<String, Object> changePassword(PasswordChange request) {
        Api.require(request != null && request.currentPassword() != null,
                400, "INVALID_INPUT", "Vui lòng nhập mật khẩu hiện tại");
        InputRules.password(request.newPassword());
        Api.require(!request.newPassword().equals(request.currentPassword()),
                400, "SAME_PASSWORD", "Mật khẩu mới phải khác mật khẩu hiện tại");
        try (Connection connection = database.getConnection()) {
            connection.setAutoCommit(false);
            Map<String, Object> account = Sql.one(connection,
                    "SELECT password_hash FROM users WHERE id=? FOR UPDATE", userId());
            Api.require(account != null && BcryptUtil.matches(request.currentPassword(),
                    (String) account.get("passwordHash")), 400,
                    "WRONG_PASSWORD", "Mật khẩu hiện tại không đúng");
            Sql.update(connection, "UPDATE users SET password_hash=?,updated_at=now() WHERE id=?",
                    BcryptUtil.bcryptHash(request.newPassword()), userId());
            Sql.update(connection, "UPDATE refresh_tokens SET revoked_at=now() WHERE user_id=? AND revoked_at IS NULL", userId());
            connection.commit();
            return Api.ok(Map.of());
        } catch (SQLException error) {
            throw new IllegalStateException("Password update failed", error);
        }
    }

    @GET @Path("/addresses")
    public Map<String, Object> addresses() {
        return Api.ok(Sql.list(database,
                "SELECT id,recipient_name,phone,province,district,ward,detail,is_default FROM addresses WHERE user_id=? ORDER BY is_default DESC,created_at",
                userId()));
    }

    @POST @Path("/addresses")
    public Map<String, Object> add(Address request) {
        validate(request);
        UUID id = UUID.randomUUID();
        saveAddress(id, request, true);
        return Api.ok(address(id));
    }

    @PUT @Path("/addresses/{id}")
    public Map<String, Object> edit(@PathParam("id") UUID id, Address request) {
        validate(request);
        Api.require(address(id) != null, 404, "NOT_FOUND", "Không tìm thấy địa chỉ");
        saveAddress(id, request, false);
        return Api.ok(address(id));
    }

    @DELETE @Path("/addresses/{id}")
    public Map<String, Object> remove(@PathParam("id") UUID id) {
        try (Connection connection = database.getConnection()) {
            connection.setAutoCommit(false);
            Map<String, Object> current = Sql.one(connection,
                    "SELECT is_default FROM addresses WHERE id=? AND user_id=? FOR UPDATE", id, userId());
            Api.require(current != null, 404, "NOT_FOUND", "Không tìm thấy địa chỉ");
            Sql.update(connection, "DELETE FROM addresses WHERE id=? AND user_id=?", id, userId());
            if (Boolean.TRUE.equals(current.get("isDefault"))) {
                Sql.update(connection,
                        "UPDATE addresses SET is_default=true,updated_at=now() WHERE id=(SELECT id FROM addresses WHERE user_id=? ORDER BY created_at LIMIT 1)",
                        userId());
            }
            connection.commit();
            return Api.ok(Map.of());
        } catch (SQLException error) {
            throw new IllegalStateException("Address deletion failed", error);
        }
    }

    private void saveAddress(UUID id, Address request, boolean create) {
        try (Connection connection = database.getConnection()) {
            connection.setAutoCommit(false);
            boolean defaultAddress = Boolean.TRUE.equals(request.isDefault());
            if (defaultAddress) Sql.update(connection,
                    "UPDATE addresses SET is_default=false WHERE user_id=?", userId());
            if (create) {
                Sql.update(connection,
                        "INSERT INTO addresses(id,user_id,recipient_name,phone,province,district,ward,detail,is_default) VALUES (?,?,?,?,?,?,?,?,?)",
                        id, userId(), request.recipientName(), request.phone(), request.province(),
                        request.district(), request.ward(), request.detail(), defaultAddress);
            } else {
                Sql.update(connection,
                        "UPDATE addresses SET recipient_name=?,phone=?,province=?,district=?,ward=?,detail=?,is_default=?,updated_at=now() WHERE id=? AND user_id=?",
                        request.recipientName(), request.phone(), request.province(), request.district(),
                        request.ward(), request.detail(), defaultAddress, id, userId());
            }
            connection.commit();
        } catch (SQLException error) {
            throw new IllegalStateException("Address update failed", error);
        }
    }

    private Map<String, Object> address(UUID id) {
        return Sql.one(database,
                "SELECT id,recipient_name,phone,province,district,ward,detail,is_default FROM addresses WHERE id=? AND user_id=?",
                id, userId());
    }

    private UUID userId() { return UUID.fromString(jwt.getSubject()); }

    private void validate(Address request) {
        Api.require(request != null && InputRules.text(request.recipientName(), 150)
                && request.phone() != null && request.phone().matches("0[0-9]{9}")
                && InputRules.text(request.province(), 120)
                && InputRules.text(request.ward(), 120) && InputRules.text(request.detail(), 300)
                && DivisionRules.valid(request.province(), request.ward())
                && (request.district() == null || request.district().isBlank()),
                400, "INVALID_INPUT", "Địa chỉ không đầy đủ");
    }
}
