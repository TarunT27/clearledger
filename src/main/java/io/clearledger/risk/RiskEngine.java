package io.clearledger.risk;

import java.util.List;

public final class RiskEngine {

    static final long UNUSUAL_AMOUNT_MINOR = 1_000_000;
    static final int REPEATED_ATTEMPT_LIMIT = 3;
    static final long VELOCITY_LIMIT_MINOR = 2_500_000;

    public RiskAssessment assess(RiskContext context) {
        boolean unusualAmount = context.amountMinor() >= UNUSUAL_AMOUNT_MINOR;
        boolean repeatedAttempts =
                context.repeatedAttemptsInWindow() >= REPEATED_ATTEMPT_LIMIT;
        boolean newRecipient = !context.establishedRecipient();
        boolean velocityLimit =
                Math.addExact(context.outgoingAmountInWindowMinor(), context.amountMinor())
                        > VELOCITY_LIMIT_MINOR;

        List<RiskSignal> signals =
                List.of(
                        signal(
                                "UNUSUAL_AMOUNT",
                                unusualAmount,
                                50,
                                "Amount meets or exceeds the unusual-payment threshold."),
                        signal(
                                "REPEATED_ATTEMPTS",
                                repeatedAttempts,
                                45,
                                "Repeated distinct payment attempts were observed."),
                        signal(
                                "NEW_RECIPIENT",
                                newRecipient,
                                40,
                                "No earlier approved payment to this recipient was found."),
                        signal(
                                "VELOCITY_LIMIT",
                                velocityLimit,
                                100,
                                "The sender would exceed the rolling outgoing limit."));

        int score =
                signals.stream()
                        .filter(RiskSignal::triggered)
                        .mapToInt(RiskSignal::score)
                        .sum();
        RiskDecision decision =
                velocityLimit
                        ? RiskDecision.REJECTED
                        : score >= 40 ? RiskDecision.REVIEW : RiskDecision.APPROVED;
        return new RiskAssessment(decision, score, signals);
    }

    private RiskSignal signal(String code, boolean triggered, int score, String explanation) {
        return new RiskSignal(code, triggered, triggered ? score : 0, explanation);
    }
}
