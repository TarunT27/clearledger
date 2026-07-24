# ClearLedger

### Real-Time Payment Risk & Reconciliation Engine

ClearLedger is a working banking-systems simulation built to answer a deceptively hard
question: **how can a payment service accept retries, evaluate risk, post a balanced
ledger, and recover from a timeout without charging twice?**

![ClearLedger operations console](docs/images/dashboard-browser.png)

It combines a Java 21 / Spring Boot API, PostgreSQL double-entry ledger, React
operations console, deterministic risk rules, idempotent payment creation, and a
reconciliation worker. The three built-in scenarios make its safety properties visible:

1. A normal payment is risk-assessed, journaled, and approved.
2. Two requests with the same idempotency key resolve to one payment and one journal.
3. A simulated timeout occurs **after** the balanced journal commits but **before**
   status finalization; reconciliation verifies the existing journal and
   compare-and-swap finalizes the payment without writing a second journal.

> ClearLedger uses fictional counterparties and simulated money. It is a portfolio
> system, not a bank, payment processor, or production financial product.

## What it demonstrates

- Java 21, Spring Boot 4.1, virtual threads, validation, JPA, and Flyway
- PostgreSQL constraints and balanced double-entry journal semantics
- REST APIs with idempotency-key conflict detection and safe concurrent retries
- Explainable risk signals: unusual amount, repeated attempts, new recipient, velocity
- Scheduled and on-demand reconciliation with optimistic compare-and-swap repair
- Structured audit events, health probes, and operationally useful failure states
- React 19, TypeScript, Vite, Vitest, and Playwright
- Multi-stage, non-root containers; Docker Compose; GitHub Actions; CodeQL; GHCR

## Run the full application

Requirements: Docker Engine with Compose v2 and at least 4 GB available memory.

```bash
cp .env.example .env
# Replace the sample POSTGRES_PASSWORD in .env before starting.
docker compose up --build --wait
```

Open [http://localhost:8088](http://localhost:8088). Compose binds the demo to the
local loopback interface only. The browser only talks to nginx;
nginx serves the static app and proxies `/api/*` to the internal API. PostgreSQL is not
published to the host.

Stop the stack while preserving its database:

```bash
docker compose down
```

Remove the local demo database as well:

```bash
docker compose down --volumes
```

## Demo the safety story

Use the scenario controls in the console in this order:

| Scenario | What to watch |
| --- | --- |
| Normal | Risk decision becomes approved, a debit and credit balance, status is final |
| Duplicate | Both attempts resolve to the same payment; payment and journal counts stay at one |
| Timeout | Journal is balanced while status remains pending; reconciliation CAS-finalizes it |

For a concise interviewer walkthrough, expected observations, and API commands, use
[the five-minute demo script](docs/demo-script.md).

## API at a glance

All money is represented as integer minor units: `25000` means USD 250.00. Mutation
requests use JSON and payment creation requires an `Idempotency-Key` header.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/api/v1/payments` | Validate, deduplicate, assess risk, and create a payment |
| `GET` | `/api/v1/payments` | List payments, optionally filtered by status |
| `GET` | `/api/v1/payments/{paymentId}` | Read payment state and risk evidence |
| `POST` | `/api/v1/demo/scenarios/normal` | Reset and execute the normal scenario |
| `POST` | `/api/v1/demo/scenarios/duplicate` | Execute a concurrent duplicate replay |
| `POST` | `/api/v1/demo/scenarios/timeout` | Commit a journal, then simulate finalization timeout |
| `POST` | `/api/v1/reconciliation/runs` | Run reconciliation with `X-ClearLedger-Request` |
| `GET` | `/actuator/health/readiness` | API readiness probe (internal in Compose) |

Example payment:

```bash
curl --fail-with-body http://localhost:8088/api/v1/payments \
  -X POST \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: demo-payment-001" \
  -d '{
    "senderId": "10000000-0000-0000-0000-000000000001",
    "recipientId": "20000000-0000-0000-0000-000000000001",
    "amountMinor": 25000,
    "currency": "USD",
    "description": "Invoice CL-1001"
  }'
```

Repeat the command unchanged to receive the original payment outcome. Reusing the same
key with a different amount is rejected as an idempotency conflict.

## Safety invariants

The implementation is intentionally conservative:

- A sender and hashed idempotency key identify at most one payment.
- An idempotency key is never persisted in plaintext.
- The same key with a different request fingerprint is a conflict, not a replay.
- A journal belongs to exactly one payment.
- Every journal contains equal debit and credit totals in one currency.
- Status moves only through explicit state-machine transitions.
- Reconciliation never "tries the payment again." It verifies the committed journal,
  then updates the still-pending row only if its expected version still matches.
- A stale worker loses the compare-and-swap and cannot overwrite newer state.

See [Architecture](docs/architecture.md) for component boundaries, schema decisions,
failure handling, and the editable [system diagram](docs/architecture.svg).

## Local development

### API

Start only PostgreSQL:

```bash
cp .env.example .env
docker compose up -d postgres
```

The database is intentionally isolated inside Compose, so for host-based API development
either publish a development-only PostgreSQL port override or use a local PostgreSQL 17
instance. Then:

```bash
./mvnw spring-boot:run
./mvnw verify
```

Configuration uses environment variables. Notable values are:

| Variable | Meaning | Compose default |
| --- | --- | --- |
| `SPRING_DATASOURCE_URL` | JDBC connection URL | internal `postgres:5432` |
| `SPRING_DATASOURCE_USERNAME` | database role | value from `.env` |
| `SPRING_DATASOURCE_PASSWORD` | required database secret | value from `.env` |
| `CLEARLEDGER_RECONCILIATION_FIXED_DELAY_MS` | reconciliation interval | `30000` |
| `CORS_ALLOWED_ORIGINS` | allowlisted local origins | localhost dev ports |

The Compose stack activates the `demo` profile so the browser can run the three
portfolio scenarios without credentials. The default non-demo profile uses HTTP Basic
authentication and restricts reconciliation and operational metrics to the `OPS` role.

### Web

```bash
cd frontend
npm ci
npm run dev
```

Useful quality gates:

```bash
npm run verify
npm run e2e
```

The production web container sets `VITE_API_BASE_URL=/api/v1` and uses a same-origin
nginx proxy. No API secret is compiled into the browser bundle.

## Repository map

```text
src/main/java/            payment, risk, ledger, reconciliation, API
src/main/resources/       configuration and Flyway migrations
src/test/                 unit and PostgreSQL Testcontainers integration tests
frontend/                 React operations console and Playwright scenarios
docs/                     architecture, demo runbook, and application screenshots
.github/workflows/        CI, security analysis, dependency review, releases
Dockerfile.api            layered non-root JVM image
Dockerfile.web            static frontend image with nginx reverse proxy
compose.yml               PostgreSQL + API + web topology
```

## CI and releases

Pull requests run Java verification against PostgreSQL/Testcontainers, frontend lint /
test / build, two container builds, Playwright browser scenarios, dependency review, and
CodeQL analysis. Weekly Dependabot groups routine Maven, npm, Docker, and Actions
updates.

Pushing a semantic version tag such as `v1.0.0` publishes multi-architecture images:

```text
ghcr.io/<owner>/<repository>-api:1.0.0
ghcr.io/<owner>/<repository>-web:1.0.0
```

Published images include GitHub build-provenance attestations.

## Security and license

Read [SECURITY.md](SECURITY.md) before deploying or reporting a vulnerability.
ClearLedger is available under the [MIT License](LICENSE).
