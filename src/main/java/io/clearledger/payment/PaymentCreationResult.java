package io.clearledger.payment;

public record PaymentCreationResult(PaymentSnapshot payment, boolean duplicate) {}
