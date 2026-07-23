# ClearLedger v1.0.0

ClearLedger is a portfolio-grade simulation of a bank payment pipeline: validation,
idempotency, explainable risk evaluation, balanced double-entry posting, ambiguous
timeout handling, and safe reconciliation.

## Highlights

- Java 21 and Spring Boot 4.1 API with PostgreSQL and Flyway
- Sender-scoped idempotency with request-fingerprint conflict detection
- Unusual-amount, repeated-attempt, new-recipient, and velocity rules
- Immutable journal model with one balanced debit/credit pair per approved payment
- Timeout injection after ledger commit and before final status
- Bounded `FOR UPDATE SKIP LOCKED` reconciliation with fresh-payment race protection
- Authenticated non-demo API and loopback-only Compose demo profile
- React 19 operations console with desktop and mobile scenario coverage
- Structured logs, metrics, health probes, non-root containers, CodeQL, and CI/CD

## Verified

- Maven verification and enforced Java coverage gate
- Vitest coverage gate, lint, type-check, and production frontend build
- Six Playwright scenario flows across desktop Chromium and Pixel 7
- PostgreSQL/Testcontainers concurrency and security integration suite in CI
- npm production dependency audit and repository credential-pattern scan

This project uses simulated money and fictional counterparties. It is not a production
banking or payment-processing service.
