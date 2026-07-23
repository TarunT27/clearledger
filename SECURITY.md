# Security Policy

## Scope

ClearLedger is an educational payment-processing simulation. It does not integrate with
real bank accounts, card networks, identity providers, or customer data. Do not use it
to move or store real money or regulated information.

Security-sensitive areas include:

- idempotency-key handling and request fingerprinting;
- payment state transitions and optimistic locking;
- journal balance and uniqueness constraints;
- reconciliation repair authorization and audit events;
- API input validation, rate limits, and error responses;
- container, dependency, and CI/CD configuration.

## Reporting a vulnerability

Please do not open a public issue for a suspected vulnerability.

Use the repository's **Security → Report a vulnerability** flow to submit a private
GitHub Security Advisory. Include:

- the affected commit, tag, endpoint, or component;
- reproduction steps or a minimal proof of concept;
- the security impact and required preconditions;
- any suggested mitigation, if known.

Do not include real credentials, personal information, account data, or production
payment details. Maintainers should acknowledge a complete report within five business
days and coordinate disclosure after a fix is available.

## Supported versions

Security fixes are applied to the latest release and the default branch. Older portfolio
demo tags are not maintained unless a release note states otherwise.

| Version | Supported |
| --- | --- |
| Latest release | Yes |
| `main` | Best effort |
| Older tags | No |

## Deployment boundary

The repository defaults are designed for a local demo, not a regulated production
environment. A real deployment must add, at minimum:

- enterprise authentication and role-based authorization;
- TLS at the ingress and encrypted database connections;
- a managed secrets service and credential rotation;
- per-principal and perimeter rate limiting;
- network policies and restricted operator access;
- immutable, centralized audit-log retention;
- backup restoration tests and disaster-recovery objectives;
- jurisdiction-specific privacy, retention, and financial controls;
- independent threat modeling, penetration testing, and compliance review.

Never commit `.env`, database dumps, tokens, private keys, or live payment data. The
checked-in `.env.example` contains placeholders only. GitHub Actions use the ephemeral
`GITHUB_TOKEN` and do not require a long-lived registry password.

## Automated controls

The repository includes:

- CodeQL analysis for Java and TypeScript;
- pull-request dependency review that blocks new high-severity vulnerabilities;
- weekly Dependabot updates;
- Maven and npm verification with reproducible lock files;
- non-root runtime containers and an internal-only database network;
- GHCR provenance attestations for tagged images.

Automated checks reduce risk but do not establish that ClearLedger is fit for production
financial use.

