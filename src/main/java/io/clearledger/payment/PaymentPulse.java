package io.clearledger.payment;

import io.clearledger.risk.RiskDecision;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;

/**
 * The four columns the overview actually needs from a payment.
 *
 * <p>Analytics windows can cover thousands of rows; loading whole entities to count them
 * would pull every column and populate the persistence context for nothing.
 */
public record PaymentPulse(
        Instant createdAt,
        PaymentStatus status,
        RiskDecision riskDecision,
        long amountMinor,
        String riskSignals) {

    public List<String> signalCodes() {
        return riskSignals == null || riskSignals.isBlank()
                ? List.of()
                : Arrays.stream(riskSignals.split(",")).filter(code -> !code.isBlank()).toList();
    }
}
