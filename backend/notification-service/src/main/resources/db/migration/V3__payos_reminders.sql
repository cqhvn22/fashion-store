ALTER TABLE notifications ADD COLUMN payment_reminder_until timestamptz;
CREATE INDEX ix_notifications_order_recipient ON notifications(order_id, recipient_user_id);

-- Terminal events can arrive before order-created because Kafka uses separate topics.
CREATE VIEW visible_in_app_notifications AS
SELECT n.* FROM notifications n
WHERE n.channel='IN_APP' AND (
    n.payment_reminder_until IS NULL OR (
        n.payment_reminder_until > now() AND NOT EXISTS (
            SELECT 1 FROM notifications resolved
            JOIN processed_events e ON e.event_id=resolved.event_id
            WHERE resolved.order_id=n.order_id AND resolved.recipient_user_id=n.recipient_user_id
              AND e.event_type IN ('fashion.payment.paid.v1','fashion.order.cancelled.v1')
        )
    )
);
