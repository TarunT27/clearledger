package io.clearledger.audit;

import java.time.Instant;
import java.util.UUID;

public record AuditEventSnapshot(
        UUID id,
        UUID paymentId,
        String eventType,
        String actor,
        String detail,
        Instant createdAt) {}
