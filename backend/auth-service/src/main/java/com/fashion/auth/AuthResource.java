package com.fashion.auth;

import com.fashion.common.Api;
import com.fashion.common.Sql;
import io.quarkus.elytron.security.common.BcryptUtil;
import io.smallrye.jwt.build.Jwt;
import jakarta.annotation.security.RolesAllowed;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.sql.Connection;
import java.time.Instant;
import java.util.Base64;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import javax.sql.DataSource;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.eclipse.microprofile.jwt.JsonWebToken;

@Path("/api/v1/auth")
@Consumes(MediaType.APPLICATION_JSON)
@Produces(MediaType.APPLICATION_JSON)
public class AuthResource {
    @Inject DataSource database;
    @Inject JsonWebToken jwt;
    @ConfigProperty(name = "auth.jwt.secret") String secret;
    @ConfigProperty(name = "auth.jwt.ttl-seconds") long ttlSeconds;
    private final SecureRandom random = new SecureRandom();

    public record Register(String fullName, String email, String phone, String password, Boolean newsletter) {}
    public record Login(String email, String password) {}
    public record Refresh(String refreshToken) {}

    @POST @Path("/register")
    public Map<String, Object> register(Register request) throws java.sql.SQLException {
        Api.require(request != null && InputRules.email(request.email())
                && InputRules.text(request.fullName(), 150) && request.phone() != null
                && request.phone().matches("0[0-9]{9}"),
                400, "INVALID_INPUT", "Email, tên hoặc mật khẩu không hợp lệ");
        InputRules.password(request.password());
        String email = request.email().trim().toLowerCase(Locale.ROOT);
        Api.require(Sql.one(database, "SELECT id FROM users WHERE lower(email)=?", email) == null,
                409, "EMAIL_EXISTS", "Email đã được sử dụng");
        UUID id = UUID.randomUUID();
        String hashedPassword = BcryptUtil.bcryptHash(request.password());
        try (Connection connection = database.getConnection()) {
            connection.setAutoCommit(false);
            int created = Sql.update(connection, "INSERT INTO users(id,email,password_hash,full_name,phone) "
                    + "VALUES (?,?,?,?,?) ON CONFLICT (lower(email)) DO NOTHING",
                    id, email, hashedPassword, request.fullName().trim(), request.phone());
            Api.require(created == 1, 409, "EMAIL_EXISTS", "Email đã được sử dụng");
            if (Boolean.TRUE.equals(request.newsletter())) {
                Sql.update(connection, NewsletterResource.SUBSCRIBE, email, UUID.randomUUID());
            }
            connection.commit();
        }
        return Api.ok(user(id));
    }

    @POST @Path("/login")
    public Map<String, Object> login(Login request) {
        Api.require(request != null && InputRules.email(request.email()) && request.password() != null,
                400, "INVALID_INPUT", "Thiếu email hoặc mật khẩu");
        Map<String, Object> row = Sql.one(database,
                "SELECT id,password_hash,role,status FROM users WHERE lower(email)=?",
                request.email().trim().toLowerCase(Locale.ROOT));
        Api.require(row != null && "ACTIVE".equals(row.get("status"))
                && BcryptUtil.matches(request.password(), (String) row.get("passwordHash")),
                401, "INVALID_CREDENTIALS", "Email hoặc mật khẩu không đúng");
        UUID id = (UUID) row.get("id");
        return Api.ok(Map.of("user", user(id),
                "accessToken", accessToken(id, (String) row.get("role")),
                "refreshToken", newRefreshToken(id)));
    }

    @POST @Path("/refresh")
    public Map<String, Object> refresh(Refresh request) {
        Api.require(request != null && request.refreshToken() != null, 400,
                "INVALID_INPUT", "Thiếu refresh token");
        try (Connection connection = database.getConnection()) {
            connection.setAutoCommit(false);
            Map<String, Object> token = Sql.one(connection,
                    "SELECT id,user_id FROM refresh_tokens WHERE token_hash=? AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at>now()) FOR UPDATE",
                    hash(request.refreshToken()));
            Api.require(token != null, 401, "INVALID_TOKEN", "Refresh token không hợp lệ");
            UUID id = (UUID) token.get("userId");
            Map<String, Object> account = Sql.one(connection, "SELECT role,status FROM users WHERE id=?", id);
            Api.require(account != null && "ACTIVE".equals(account.get("status")), 401,
                    "INVALID_TOKEN", "Tài khoản không khả dụng");
            Sql.update(connection, "UPDATE refresh_tokens SET revoked_at=now() WHERE id=?", token.get("id"));
            String next = randomToken();
            Sql.update(connection, "INSERT INTO refresh_tokens(id,user_id,token_hash) VALUES (?,?,?)",
                    UUID.randomUUID(), id, hash(next));
            connection.commit();
            return Api.ok(Map.of("accessToken", accessToken(id, (String) account.get("role")),
                    "refreshToken", next));
        } catch (java.sql.SQLException error) {
            throw new IllegalStateException("Refresh failed", error);
        }
    }

    @POST @Path("/logout")
    @RolesAllowed({"USER", "ADMIN"})
    public Map<String, Object> logout(Refresh request) {
        if (request != null && request.refreshToken() != null) {
            Sql.update(database, "UPDATE refresh_tokens SET revoked_at=now() WHERE token_hash=? AND user_id=?",
                    hash(request.refreshToken()), UUID.fromString(jwt.getSubject()));
        }
        return Api.ok(Map.of());
    }

    private Map<String, Object> user(UUID id) {
        return Sql.one(database, "SELECT id,email,full_name,phone,avatar_url,role,status,created_at FROM users WHERE id=?", id);
    }

    private String accessToken(UUID id, String role) {
        return Jwt.issuer("fashion-auth").subject(id.toString()).upn(id.toString())
                .groups(Set.of(role)).claim("exp", Instant.now().plusSeconds(ttlSeconds).getEpochSecond())
                .signWithSecret(secret);
    }

    private String newRefreshToken(UUID id) {
        String token = randomToken();
        Sql.update(database, "INSERT INTO refresh_tokens(id,user_id,token_hash) VALUES (?,?,?)",
                UUID.randomUUID(), id, hash(token));
        return token;
    }

    private String randomToken() {
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private static String hash(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8));
            return java.util.HexFormat.of().formatHex(digest);
        } catch (java.security.NoSuchAlgorithmException impossible) {
            throw new IllegalStateException(impossible);
        }
    }
}
