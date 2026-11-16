CREATE TABLE notification_templates (
    id UUID PRIMARY KEY,
    code VARCHAR(80) NOT NULL,
    channel VARCHAR(10) NOT NULL
        CHECK (channel IN ('EMAIL', 'SMS', 'IN_APP')),
    subject VARCHAR(250),
    body TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (code, channel)
);

CREATE TABLE processed_events (
    event_id UUID PRIMARY KEY,
    event_type VARCHAR(80) NOT NULL,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE notifications (
    id UUID PRIMARY KEY,
    event_id UUID NOT NULL REFERENCES processed_events(event_id),
    template_id UUID REFERENCES notification_templates(id) ON DELETE SET NULL,
    recipient_user_id UUID NOT NULL,
    order_id UUID,
    channel VARCHAR(10) NOT NULL
        CHECK (channel IN ('EMAIL', 'SMS', 'IN_APP')),
    destination VARCHAR(255) NOT NULL,
    subject VARCHAR(250),
    body TEXT NOT NULL,
    status VARCHAR(12) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'SENT', 'FAILED')),
    attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
    next_attempt_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (event_id, recipient_user_id, channel)
);
CREATE INDEX ix_notifications_pending
    ON notifications (next_attempt_at, created_at)
    WHERE status IN ('PENDING', 'FAILED');
CREATE INDEX ix_notifications_recipient
    ON notifications (recipient_user_id, created_at DESC);

CREATE TABLE notification_attempts (
    id UUID PRIMARY KEY,
    notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
    attempted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    success BOOLEAN NOT NULL,
    provider_message_id VARCHAR(255),
    error_message TEXT
);
CREATE INDEX ix_notification_attempts_notification
    ON notification_attempts (notification_id, attempted_at DESC);
