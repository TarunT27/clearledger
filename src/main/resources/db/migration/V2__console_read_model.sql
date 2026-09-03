-- ClearLedger V2: named counterparties and durable reconciliation history.
--
-- V1 modelled senders and recipients as bare UUIDs, which is correct for the ledger
-- but unusable for an operator: a reviewer cannot judge a payment to
-- "20000000-0000-0000-0000-000000000001". Counterparties are reference data, so they
-- ship with the migration rather than with demo seeding.

CREATE TABLE counterparties (
    id UUID PRIMARY KEY,
    display_name VARCHAR(120) NOT NULL,
    legal_name VARCHAR(160) NOT NULL,
    reference VARCHAR(32) NOT NULL UNIQUE,
    category VARCHAR(40) NOT NULL,
    country VARCHAR(2) NOT NULL CHECK (country ~ '^[A-Z]{2}$'),
    role VARCHAR(16) NOT NULL CHECK (role IN ('SENDER', 'RECIPIENT')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_counterparties_role_name ON counterparties(role, display_name);

-- Reconciliation previously returned a run summary that was never stored, so the
-- console could not show whether the worker had run at all. Runs are now durable.
CREATE TABLE reconciliation_runs (
    id UUID PRIMARY KEY,
    started_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ NOT NULL,
    scanned INTEGER NOT NULL CHECK (scanned >= 0),
    repaired INTEGER NOT NULL CHECK (repaired >= 0),
    flagged INTEGER NOT NULL CHECK (flagged >= 0),
    trigger_source VARCHAR(16) NOT NULL
        CHECK (trigger_source IN ('SCHEDULED', 'MANUAL', 'TARGETED'))
);

CREATE INDEX idx_reconciliation_runs_started ON reconciliation_runs(started_at DESC);

-- Operators quote payments to each other out loud. A UUID cannot be quoted, so every
-- payment now carries a short stable reference derived from its own identifier. Deriving
-- it in SQL keeps existing rows and new rows on exactly the same rule.
ALTER TABLE payments ADD COLUMN reference VARCHAR(16);

UPDATE payments
   SET reference = 'PAY-'
       || upper(substr(replace(id::text, '-', ''), 1, 4))
       || upper(substr(replace(id::text, '-', ''), 29, 4));

ALTER TABLE payments ALTER COLUMN reference SET NOT NULL;
CREATE UNIQUE INDEX uq_payments_reference ON payments(reference);

-- The console lists payments, journals, and audit events newest-first across the whole
-- table, which V1 had no index for.
CREATE INDEX idx_payments_created ON payments(created_at DESC);
CREATE INDEX idx_payments_risk_decision ON payments(risk_decision, created_at DESC);
CREATE INDEX idx_journals_created ON journals(created_at DESC);
CREATE INDEX idx_audit_created ON audit_events(created_at DESC);
CREATE INDEX idx_audit_event_type ON audit_events(event_type, created_at DESC);

INSERT INTO counterparties (id, display_name, legal_name, reference, category, country, role)
VALUES
('10000000-0000-0000-0000-000000000001', 'Atlas Operating', 'Atlas Operating Company LLC', 'CL-SND-0001', 'Operating account', 'US', 'SENDER'),
('10000000-0000-0000-0000-000000000002', 'Atlas Payroll', 'Atlas Operating Company LLC', 'CL-SND-0002', 'Payroll account', 'US', 'SENDER'),
('10000000-0000-0000-0000-000000000003', 'Atlas Treasury', 'Atlas Treasury Services Inc', 'CL-SND-0003', 'Treasury account', 'US', 'SENDER'),
('20000000-0000-0000-0000-000000000001', 'Northstar Supplies', 'Northstar Supplies Corporation', 'CL-RCP-0001', 'Supplier', 'US', 'RECIPIENT'),
('20000000-0000-0000-0000-000000000002', 'Redstone Industrial', 'Redstone Industrial Group Ltd', 'CL-RCP-0002', 'Supplier', 'GB', 'RECIPIENT'),
('20000000-0000-0000-0000-000000000003', 'Maple Rock Construction', 'Maple Rock Construction Inc', 'CL-RCP-0003', 'Contractor', 'CA', 'RECIPIENT'),
('20000000-0000-0000-0000-000000000004', 'Harborline Logistics', 'Harborline Logistics BV', 'CL-RCP-0004', 'Logistics', 'NL', 'RECIPIENT'),
('20000000-0000-0000-0000-000000000005', 'Vantage Analytics', 'Vantage Analytics Limited', 'CL-RCP-0005', 'Software vendor', 'IE', 'RECIPIENT'),
('20000000-0000-0000-0000-000000000006', 'Quarry Lane Metals', 'Quarry Lane Metals Pty', 'CL-RCP-0006', 'Supplier', 'AU', 'RECIPIENT'),
('20000000-0000-0000-0000-000000000007', 'Sable Creek Farms', 'Sable Creek Farms LLC', 'CL-RCP-0007', 'Supplier', 'US', 'RECIPIENT'),
('20000000-0000-0000-0000-000000000008', 'Ironwood Facilities', 'Ironwood Facilities Management', 'CL-RCP-0008', 'Facilities', 'US', 'RECIPIENT'),
('20000000-0000-0000-0000-000000000009', 'Beacon Legal Partners', 'Beacon Legal Partners LLP', 'CL-RCP-0009', 'Professional services', 'GB', 'RECIPIENT'),
('20000000-0000-0000-0000-00000000000a', 'Cobalt Freight', 'Cobalt Freight Systems SA', 'CL-RCP-0010', 'Logistics', 'FR', 'RECIPIENT'),
('20000000-0000-0000-0000-00000000000b', 'Pinehurst Media', 'Pinehurst Media Group Inc', 'CL-RCP-0011', 'Marketing', 'US', 'RECIPIENT'),
('20000000-0000-0000-0000-00000000000c', 'Solace Health Benefits', 'Solace Health Benefits Inc', 'CL-RCP-0012', 'Benefits', 'US', 'RECIPIENT'),
('20000000-0000-0000-0000-00000000000d', 'Lantern Data Centers', 'Lantern Data Centers GmbH', 'CL-RCP-0013', 'Infrastructure', 'DE', 'RECIPIENT'),
('20000000-0000-0000-0000-00000000000e', 'Wexford Components', 'Wexford Components Kabushiki', 'CL-RCP-0014', 'Supplier', 'JP', 'RECIPIENT');

-- Established payees. Every recipient except the two newest is a known payee for every
-- sender, which is what an onboarded book of vendors looks like. The two exceptions are
-- left out deliberately: the NEW_RECIPIENT rule needs something to fire on, and a payment
-- to an unapproved payee genuinely should reach a human.
INSERT INTO established_recipients (sender_id, recipient_id)
SELECT s.id, r.id
  FROM counterparties s
  CROSS JOIN counterparties r
 WHERE s.role = 'SENDER'
   AND r.role = 'RECIPIENT'
   AND r.reference NOT IN ('CL-RCP-0011', 'CL-RCP-0014')
ON CONFLICT DO NOTHING;
