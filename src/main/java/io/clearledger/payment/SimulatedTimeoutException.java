package io.clearledger.payment;

import java.util.UUID;

public class SimulatedTimeoutException extends RuntimeException {
    private final UUID paymentId;

    public SimulatedTimeoutException(UUID paymentId) {
        super("A simulated downstream timeout occurred after the ledger transaction committed.");
        this.paymentId = paymentId;
    }

    public UUID paymentId() {
        return paymentId;
    }
}
