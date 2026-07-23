package io.clearledger.payment;

public class InvalidIdempotencyKeyException extends RuntimeException {
    public InvalidIdempotencyKeyException() {
        super("Idempotency-Key must contain between 8 and 200 printable characters.");
    }
}
