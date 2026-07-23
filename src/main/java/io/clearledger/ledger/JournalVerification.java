package io.clearledger.ledger;

public record JournalVerification(boolean balanced, boolean matchesPayment) {}
