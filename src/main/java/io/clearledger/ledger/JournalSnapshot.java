package io.clearledger.ledger;

import java.util.List;
import java.util.UUID;

public record JournalSnapshot(UUID id, UUID paymentId, List<JournalLineSnapshot> lines) {
    public JournalSnapshot {
        lines = List.copyOf(lines);
    }
}
