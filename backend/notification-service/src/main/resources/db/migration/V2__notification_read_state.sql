ALTER TABLE notifications ADD COLUMN read_at TIMESTAMPTZ;
CREATE INDEX ix_notifications_unread_recipient
ON notifications (recipient_user_id, created_at DESC) WHERE read_at IS NULL;
