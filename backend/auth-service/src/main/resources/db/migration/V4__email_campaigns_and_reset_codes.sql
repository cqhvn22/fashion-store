CREATE TABLE password_reset_codes (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    request_id UUID NOT NULL,
    code_hash VARCHAR(64) NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE newsletter_subscriptions (
    email VARCHAR(255) PRIMARY KEY,
    token UUID NOT NULL UNIQUE,
    subscribed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    unsubscribed_at TIMESTAMPTZ
);

CREATE TABLE email_campaigns (
    id UUID PRIMARY KEY,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    subject VARCHAR(150) NOT NULL,
    content JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE email_campaign_recipients (
    id UUID PRIMARY KEY,
    campaign_id UUID NOT NULL REFERENCES email_campaigns(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    status VARCHAR(12) NOT NULL DEFAULT 'QUEUED'
        CHECK (status IN ('QUEUED','SENDING','ACCEPTED','FAILED','SKIPPED')),
    attempts INTEGER NOT NULL DEFAULT 0,
    next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_error TEXT,
    UNIQUE(campaign_id, email)
);
CREATE INDEX ix_campaign_pending ON email_campaign_recipients(next_attempt_at)
    WHERE status IN ('QUEUED','SENDING');
