CREATE TABLE payments (
    id UUID PRIMARY KEY,
    sender_id UUID NOT NULL,
    recipient_id UUID NOT NULL,
    amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
    currency VARCHAR(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
    description VARCHAR(140) NOT NULL,
    status VARCHAR(16) NOT NULL CHECK (status IN ('PENDING','APPROVED','REVIEW','REJECTED')),
    risk_decision VARCHAR(16) NOT NULL CHECK (risk_decision IN ('APPROVED','REVIEW','REJECTED')),
    risk_score INTEGER NOT NULL CHECK (risk_score >= 0),
    risk_signals VARCHAR(512) NOT NULL,
    idempotency_key_hash CHAR(64) NOT NULL,
    request_fingerprint CHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    reconciliation_required BOOLEAN NOT NULL DEFAULT FALSE,
    version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT uq_payment_sender_idempotency UNIQUE (sender_id, idempotency_key_hash)
);

CREATE INDEX idx_payments_sender_created ON payments(sender_id, created_at DESC);
CREATE INDEX idx_payments_status_created ON payments(status, created_at);
CREATE INDEX idx_payments_reconciliation
    ON payments(status, reconciliation_required, created_at);
CREATE INDEX idx_payments_sender_recipient_status
    ON payments(sender_id, recipient_id, status);

CREATE TABLE sender_locks (
    sender_id UUID PRIMARY KEY,
    touched_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE established_recipients (
    sender_id UUID NOT NULL,
    recipient_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (sender_id, recipient_id)
);

CREATE TABLE journals (
    id UUID PRIMARY KEY,
    payment_id UUID NOT NULL UNIQUE REFERENCES payments(id),
    created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE journal_entries (
    id UUID PRIMARY KEY,
    journal_id UUID NOT NULL REFERENCES journals(id),
    account_id VARCHAR(80) NOT NULL,
    direction VARCHAR(8) NOT NULL CHECK (direction IN ('DEBIT','CREDIT')),
    amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
    currency VARCHAR(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
    created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_journal_entries_journal ON journal_entries(journal_id);

CREATE TABLE audit_events (
    id UUID PRIMARY KEY,
    payment_id UUID REFERENCES payments(id),
    event_type VARCHAR(64) NOT NULL,
    actor VARCHAR(64) NOT NULL,
    detail VARCHAR(1000) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_audit_payment_created ON audit_events(payment_id, created_at);

INSERT INTO established_recipients(sender_id, recipient_id)
VALUES
('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001');
