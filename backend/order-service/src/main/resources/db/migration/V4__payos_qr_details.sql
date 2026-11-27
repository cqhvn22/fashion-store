ALTER TABLE payment_attempts
    ADD COLUMN qr_code TEXT,
    ADD COLUMN account_number VARCHAR(80),
    ADD COLUMN account_name VARCHAR(250),
    ADD COLUMN transfer_description VARCHAR(250);
