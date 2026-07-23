package io.clearledger.ledger;

public record JournalLineSnapshot(
        String accountId, EntryDirection direction, long amountMinor, String currency) {}
