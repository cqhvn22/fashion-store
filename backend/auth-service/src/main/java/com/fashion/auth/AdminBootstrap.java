package com.fashion.auth;

import com.fashion.common.Sql;
import io.quarkus.elytron.security.common.BcryptUtil;
import io.quarkus.runtime.StartupEvent;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.inject.Inject;
import java.util.Locale;
import java.util.UUID;
import javax.sql.DataSource;
import org.eclipse.microprofile.config.inject.ConfigProperty;

@ApplicationScoped
public class AdminBootstrap {
    @Inject DataSource database;
    @ConfigProperty(name = "auth.admin.email", defaultValue = "") String email;
    @ConfigProperty(name = "auth.admin.password", defaultValue = "") String password;

    void initialize(@Observes StartupEvent ignored) {
        if (email.isBlank() || password.isBlank()) return;
        if (password.length() < 12) {
            throw new IllegalStateException("ADMIN_PASSWORD must have at least 12 characters");
        }
        String normalized = email.trim().toLowerCase(Locale.ROOT);
        if (Sql.one(database, "SELECT id FROM users WHERE lower(email)=?", normalized) == null) {
            Sql.update(database,
                    "INSERT INTO users(id,email,password_hash,full_name,role) VALUES (?,?,?,?,'ADMIN')",
                    UUID.randomUUID(), normalized, BcryptUtil.bcryptHash(password), "Administrator");
        }
    }
}
