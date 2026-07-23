package io.clearledger.payment;

public final class PaymentStateMachine {

    private PaymentStateMachine() {}

    public static PaymentStatus transition(PaymentStatus current, PaymentStatus target) {
        if (current == target) {
            return current;
        }
        if (current != PaymentStatus.PENDING || target == PaymentStatus.PENDING) {
            throw new IllegalStateException(
                    "Illegal payment status transition from " + current + " to " + target);
        }
        return target;
    }
}
