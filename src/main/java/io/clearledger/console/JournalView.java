package io.clearledger.console;

import io.clearledger.ledger.EntryDirection;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** A posted journal with the totals and verification results the ledger page shows. */
public record JournalView(
        UUID id,
        String reference,
        UUID paymentId,
        String paymentReference,
        String counterpartyName,
        Instant createdAt,
        String currency,
        long totalDebitsMinor,
        long totalCreditsMinor,
        boolean balanced,
        boolean matchesPayment,
        List<Line> lines) {

    public JournalView {
        lines = List.copyOf(lines);
    }

    public record Line(
            String accountId,
            String accountLabel,
            EntryDirection direction,
            long amountMinor,
            String currency) {}
}
