package io.clearledger.risk;

public record RiskContext(
        long amountMinor,
        int repeatedAttemptsInWindow,
        boolean establishedRecipient,
        long outgoingAmountInWindowMinor) {}
