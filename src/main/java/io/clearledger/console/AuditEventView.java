package io.clearledger.console;

import java.time.Instant;
import java.util.UUID;

/** One append-only audit record, described in operator language. */
public record AuditEventView(
        UUID id,
        UUID paymentId,
        String paymentReference,
        String eventType,
        String label,
        String actor,
        String detail,
        String tone,
        Instant createdAt) {}
