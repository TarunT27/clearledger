package io.clearledger.payment;

import java.util.Locale;
import java.util.UUID;

public record PaymentRequestData(
        UUID senderId,
        UUID recipientId,
        long amountMinor,
        String currency,
        String description) {

    public PaymentRequestData {
        currency = currency == null ? "" : currency.strip().toUpperCase(Locale.ROOT);
        description = description == null ? "" : description.strip();
    }
}
