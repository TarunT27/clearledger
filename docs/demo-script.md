# ClearLedger Five-Minute Demo

## Before the interview

```bash
cp .env.example .env
# Replace POSTGRES_PASSWORD in .env.
docker compose up --build --wait
```

Confirm:

```bash
docker compose ps
curl --fail http://localhost:8088/healthz
```

Open [http://localhost:8088](http://localhost:8088) at a wide desktop viewport. Keep a
terminal beside the browser so the system behavior and API evidence can be shown
together.

Start on **Overview** to establish the live operations context, then open **Scenario
lab** from the left navigation for the deterministic safety demonstrations.

## Opening — 30 seconds

“ClearLedger simulates the safety boundary of a bank payment system. Every request is
validated, deduplicated, scored for explainable risk, posted to a balanced journal, and
finalized. The interesting case is a timeout after the ledger commit: reconciliation
uses durable facts to safely finish the status without posting money twice.”

Point out:

- one payment status timeline;
- the risk decision and individual signals;
- debit and credit journal lines;
- idempotency metadata and audit evidence;
- reconciliation state.

## Scenario 1: normal payment — 60 seconds

In **Scenario lab**, select **Normal**.

Expected result:

- status ends as `APPROVED`;
- risk evidence shows why it passed;
- there is one journal with matching debit and credit totals;
- the audit trail ends with final status committed.

Say: “The API never accepts decimal money. This amount is integer minor units, and the
journal is posted inside a database transaction. Final state is explicit rather than
inferred from an HTTP response.”

Optional API call:

```bash
curl --fail-with-body \
  -X POST http://localhost:8088/api/v1/demo/scenarios/normal
```

## Scenario 2: duplicate request — 75 seconds

Select **Duplicate**.

Expected result:

- two concurrent attempts show the same payment identifier;
- the second request is marked as a replay;
- payment count remains one;
- journal count remains one, with two balanced entries.

Say: “The idempotency key is scoped to the sender and hashed at rest. A request
fingerprint distinguishes a legitimate retry from accidental key reuse. The database
unique constraint—not timing between Java threads—is the final concurrency guard.”

Run the API scenario:

```bash
curl --fail-with-body \
  -X POST http://localhost:8088/api/v1/demo/scenarios/duplicate
```

Mention the negative case: the same idempotency key with a changed amount returns a
conflict instead of silently returning or creating the wrong payment.

## Scenario 3: timeout and reconciliation — 120 seconds

Select **Timeout**.

Pause on the incomplete state:

- the balanced journal has committed;
- payment status remains `PENDING`;
- no debit or credit line is missing;
- reconciliation identifies “journal posted / final status pending.”

Say: “This distinction is essential. I am not repairing half a journal. I am recovering
a status projection around an already durable, balanced financial fact.”

Run reconciliation:

```bash
curl --fail-with-body \
  -H "X-ClearLedger-Request: ClearLedgerConsole" \
  -X POST http://localhost:8088/api/v1/reconciliation/runs
```

Expected result:

- journal validation passes;
- compare-and-swap uses the observed payment version;
- status finalizes to the stored risk decision;
- journal and entry counts do not change;
- an audit event attributes the reconciliation repair.

Say: “Reconciliation never resubmits the payment and never creates a second ledger
record. If another worker already changed the version, this worker loses the CAS and
cannot overwrite newer state.”

The underlying sequence:

```text
request → validate → idempotency → risk → balanced journal commit
                                                     ↓
                                        simulated finalization timeout
                                                     ↓
reconciliation → verify journal → plan → CAS status update → audit
```

## Close — 30 seconds

“The project’s core claim is not that failures disappear. It is that failure states are
durable, explainable, detectable, and safe to reconcile. Tests exercise concurrent
duplicates against PostgreSQL Testcontainers, the three browser journeys run in
Playwright, and tagged builds publish attested API and web images to GHCR.”

## Reset

The demo endpoints seed deterministic scenarios. To reset all local persisted state:

```bash
docker compose down --volumes
docker compose up --build --wait
```

This removes the named local demo volume. Do not use this reset command against an
environment containing data you intend to preserve.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Web does not become healthy | `docker compose logs web` |
| API readiness fails | `docker compose logs api`; confirm datasource variables |
| PostgreSQL is unhealthy | replace placeholder password and inspect `docker compose logs postgres` |
| Port 8088 is occupied | set a different `WEB_PORT` in `.env` |
| Browser data looks stale | rerun a scenario endpoint; do not manually edit database rows |
