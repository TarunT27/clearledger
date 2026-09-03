package io.clearledger.console;

import io.clearledger.counterparty.CounterpartySnapshot;
import io.clearledger.payment.PaymentStatus;
import io.clearledger.risk.RiskDecision;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** One line in the payments table: everything shown without opening the record. */
public record PaymentRow(
        UUID id,
        String reference,
        CounterpartySnapshot sender,
        CounterpartySnapshot recipient,
        long amountMinor,
        String currency,
        String description,
        PaymentStatus status,
        RiskDecision riskDecision,
        int riskScore,
        List<String> riskSignals,
        boolean journalPosted,
        UUID journalId,
        boolean reconciliationRequired,
        long version,
        Instant createdAt,
        Instant updatedAt) {

    public PaymentRow {
        riskSignals = List.copyOf(riskSignals);
    }
}
