package io.clearledger.payment;

import java.util.UUID;

public class PaymentNotFoundException extends RuntimeException {
    public PaymentNotFoundException(UUID id) {
        super("Payment " + id + " was not found.");
    }
}
