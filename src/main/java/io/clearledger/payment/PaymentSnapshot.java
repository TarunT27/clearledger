package io.clearledger.payment;

import io.clearledger.risk.RiskDecision;
import io.clearledger.risk.RiskSignal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record PaymentSnapshot(
        UUID id,
        String reference,
        UUID senderId,
        UUID recipientId,
        long amountMinor,
        String currency,
        String description,
        PaymentStatus status,
        RiskDecision riskDecision,
        int riskScore,
        List<RiskSignal> riskSignals,
        Instant createdAt,
        Instant updatedAt) {

    public PaymentSnapshot {
        riskSignals = List.copyOf(riskSignals);
    }
}
