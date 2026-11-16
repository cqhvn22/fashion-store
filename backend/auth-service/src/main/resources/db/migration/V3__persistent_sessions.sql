ALTER TABLE refresh_tokens ALTER COLUMN expires_at DROP NOT NULL;
UPDATE refresh_tokens SET expires_at = NULL
WHERE revoked_at IS NULL AND expires_at > now();
