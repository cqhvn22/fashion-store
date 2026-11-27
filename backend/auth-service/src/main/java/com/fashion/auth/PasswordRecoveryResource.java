package com.fashion.auth;

import com.fashion.common.Api;
import com.fashion.common.Sql;
import io.quarkus.elytron.security.common.BcryptUtil;
import jakarta.enterprise.event.Event;
import jakarta.enterprise.event.ObservesAsync;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import javax.sql.DataSource;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.sql.Connection;
import java.sql.SQLException;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Path("/api/v1/auth")
@Consumes(MediaType.APPLICATION_JSON)
@Produces(MediaType.APPLICATION_JSON)
public class PasswordRecoveryResource {
    private static final Logger LOG = Logger.getLogger(PasswordRecoveryResource.class);
    private static final String INVALID_CODE = "Mã xác thực sai hoặc đã hết hạn. Bạn có thể yêu cầu mã mới.";
    private final SecureRandom random = new SecureRandom();
    @Inject DataSource database;
    @Inject ResendMail mail;
    @Inject Event<CodeMail> codeMail;
    @ConfigProperty(name = "auth.jwt.secret") String secret;

    public record Forgot(String email) {}
    public record Verify(String email, String code) {}
    public record Reset(String token, String password) {}
    record CodeMail(String email, UUID id, String code) {}

    @POST @Path("/forgot-password")
    public Map<String, Object> forgot(Forgot request) throws SQLException {
        Api.require(request != null && InputRules.email(request.email()), 400, "INVALID_EMAIL", "Email không hợp lệ");
        mail.requireConfigured();
        String email = request.email().trim().toLowerCase(Locale.ROOT);
        UUID id = UUID.randomUUID();
        String code = String.format(Locale.ROOT, "%06d", random.nextInt(1_000_000));
        boolean created = false;
        try (Connection connection = database.getConnection()) {
            connection.setAutoCommit(false);
            var user = lockUser(connection, email);
            if (user != null) {
                created = Sql.update(connection, """
                    INSERT INTO password_reset_codes(user_id,request_id,code_hash,expires_at)
                    VALUES (?,?,?,now()+interval '10 minutes')
                    ON CONFLICT (user_id) DO UPDATE SET request_id=excluded.request_id,
                        code_hash=excluded.code_hash, expires_at=excluded.expires_at,
                        attempts=0, requested_at=now()
                    WHERE password_reset_codes.requested_at<=now()-interval '1 minute'
                    """, user.get("id"), id, codeDigest(id, code)) == 1;
                if (created) consumeTokens(connection, user.get("id"));
            }
            connection.commit();
        }
        if (created) codeMail.fireAsync(new CodeMail(email, id, code)).exceptionally(error -> {
            LOG.warn("Password recovery email task failed");
            return null;
        });
        return Api.ok(Map.of());
    }

    void sendCode(@ObservesAsync CodeMail message) {
        String plain = "Mã xác thực FashionHub của bạn là " + message.code()
                + ". Mã có hiệu lực 10 phút. Nếu bạn không yêu cầu, hãy bỏ qua email này.";
        String html = """
            <div style="background:#f5f5f5;padding:24px;font-family:Arial,sans-serif">
            <div style="background:white;max-width:500px;margin:auto;padding:32px;color:#181818">
            <strong style="color:#d90016">FASHIONHUB</strong><h1>Xác thực đặt lại mật khẩu</h1>
            <p>Nhập mã sau trên FashionHub. Mã có hiệu lực trong 10 phút.</p>
            <p style="font-size:32px;font-weight:bold;letter-spacing:8px;background:#f5f5f5;padding:16px;text-align:center">%s</p>
            <p>Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này.</p></div></div>
            """.formatted(message.code());
        String key = "password-reset/" + message.id();
        var result = mail.send(message.email(), "Mã xác thực FashionHub", html, plain, key, Map.of());
        if (result.retryable() && result.retryAfter() <= 5) {
            if (result.retryAfter() > 0) {
                try {
                    Thread.sleep(java.time.Duration.ofSeconds(result.retryAfter()));
                } catch (InterruptedException error) {
                    Thread.currentThread().interrupt();
                    return;
                }
            }
            result = mail.send(message.email(), "Mã xác thực FashionHub", html, plain, key, Map.of());
        }
        if (!result.accepted()) LOG.warn("Password recovery email was not accepted by Resend");
    }

    @POST @Path("/verify-reset-code")
    public Map<String, Object> verify(Verify request) throws SQLException {
        Api.require(request != null && InputRules.email(request.email())
                && request.code() != null && request.code().matches("[0-9]{6}"), 400, "INVALID_CODE", INVALID_CODE);
        String token = null;
        try (Connection connection = database.getConnection()) {
            connection.setAutoCommit(false);
            var user = lockUser(connection, request.email().trim().toLowerCase(Locale.ROOT));
            if (user != null) {
                Object userId = user.get("id");
                var row = Sql.one(connection, "SELECT request_id,code_hash FROM password_reset_codes "
                        + "WHERE user_id=? AND expires_at>now() AND attempts<5", userId);
                if (row != null && MessageDigest.isEqual(codeDigest((UUID) row.get("requestId"), request.code())
                        .getBytes(StandardCharsets.US_ASCII), ((String) row.get("codeHash")).getBytes(StandardCharsets.US_ASCII))) {
                    byte[] bytes = new byte[32];
                    random.nextBytes(bytes);
                    token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
                    Sql.update(connection, "UPDATE password_reset_codes SET expires_at=now() WHERE user_id=?", userId);
                    consumeTokens(connection, userId);
                    Sql.update(connection, "INSERT INTO password_reset_tokens(id,user_id,token_hash,expires_at) "
                            + "VALUES (?,?,?,now()+interval '10 minutes')", UUID.randomUUID(), userId, tokenDigest(token));
                } else if (row != null) {
                    Sql.update(connection, "UPDATE password_reset_codes SET attempts=attempts+1 WHERE user_id=?", userId);
                }
            }
            connection.commit();
        }
        Api.require(token != null, 400, "INVALID_CODE", INVALID_CODE);
        return Api.ok(Map.of("token", token));
    }

    @POST @Path("/reset-password")
    public Map<String, Object> reset(Reset request) throws SQLException {
        Api.require(request != null && request.token() != null && request.token().matches("[A-Za-z0-9_-]{43}"),
                400, "INVALID_RESET", "Phiên đặt lại mật khẩu đã hết hạn");
        InputRules.password(request.password());
        try (Connection connection = database.getConnection()) {
            connection.setAutoCommit(false);
            String digest = tokenDigest(request.token());
            var user = Sql.one(connection, "SELECT u.id FROM users u JOIN password_reset_tokens t ON u.id=t.user_id "
                    + "WHERE t.token_hash=? AND u.status='ACTIVE' FOR UPDATE OF u", digest);
            Api.require(user != null && Sql.update(connection, "UPDATE password_reset_tokens SET used_at=now() "
                    + "WHERE token_hash=? AND used_at IS NULL AND expires_at>now()", digest) == 1,
                    400, "INVALID_RESET", "Phiên đặt lại mật khẩu đã hết hạn");
            Sql.update(connection, "UPDATE users SET password_hash=?,updated_at=now() WHERE id=?",
                    BcryptUtil.bcryptHash(request.password()), user.get("id"));
            consumeTokens(connection, user.get("id"));
            Sql.update(connection, "UPDATE refresh_tokens SET revoked_at=now() WHERE user_id=? AND revoked_at IS NULL", user.get("id"));
            connection.commit();
        }
        return Api.ok(Map.of());
    }

    private Map<String, Object> lockUser(Connection connection, String email) throws SQLException {
        return Sql.one(connection, "SELECT id FROM users WHERE lower(email)=? AND status='ACTIVE' FOR UPDATE", email);
    }

    private void consumeTokens(Connection connection, Object userId) throws SQLException {
        Sql.update(connection, "UPDATE password_reset_tokens SET used_at=now() WHERE user_id=? AND used_at IS NULL", userId);
    }

    private String codeDigest(UUID id, String code) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return HexFormat.of().formatHex(mac.doFinal(("password-code:" + id + ":" + code).getBytes(StandardCharsets.UTF_8)));
        } catch (java.security.GeneralSecurityException error) {
            throw new IllegalStateException(error);
        }
    }

    private static String tokenDigest(String token) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.US_ASCII)));
        } catch (java.security.NoSuchAlgorithmException error) {
            throw new IllegalStateException(error);
        }
    }
}
