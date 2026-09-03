package io.clearledger.console;

import io.clearledger.console.OverviewReport.DecisionSlice;
import io.clearledger.console.OverviewReport.SignalActivity;
import java.util.List;

/** Policy state plus the evidence behind it, for the risk workbench. */
public record RiskReport(
        String range,
        String rangeLabel,
        long assessedPayments,
        double averageScore,
        List<SignalActivity> signals,
        List<DecisionSlice> decisionMix,
        List<PaymentRow> reviewQueue,
        List<PaymentRow> rejectedQueue,
        Policy policy) {

    public RiskReport {
        signals = List.copyOf(signals);
        decisionMix = List.copyOf(decisionMix);
        reviewQueue = List.copyOf(reviewQueue);
        rejectedQueue = List.copyOf(rejectedQueue);
    }

    /** The thresholds the engine actually used, read from the engine, not retyped. */
    public record Policy(
            long unusualAmountMinor,
            int repeatedAttemptLimit,
            long velocityLimitMinor,
            int reviewScoreThreshold,
            int attemptWindowMinutes,
            int velocityWindowMinutes) {}
}
