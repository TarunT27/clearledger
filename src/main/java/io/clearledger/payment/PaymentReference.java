package io.clearledger.payment;

import java.util.Locale;
import java.util.UUID;

/**
 * Short, stable, human-quotable handle for a payment, e.g. {@code PAY-8C42A1F0}.
 *
 * <p>It is derived from the payment's own identifier rather than a sequence, so it needs
 * no counter, never collides across instances, and the V2 backfill reproduces it in SQL
 * for rows written before the column existed.
 */
public final class PaymentReference {

    private PaymentReference() {}

    public static String of(UUID paymentId) {
        String hex = paymentId.toString().replace("-", "").toUpperCase(Locale.ROOT);
        return "PAY-" + hex.substring(0, 4) + hex.substring(28, 32);
    }
}
