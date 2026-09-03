package io.clearledger.console;

import java.time.Instant;
import java.util.List;

/** The operations overview, computed from the database rather than the browser. */
public record OverviewReport(
        String range,
        String rangeLabel,
        Instant generatedAt,
        Instant windowStart,
        List<Metric> metrics,
        List<ThroughputBucket> throughput,
        List<DecisionSlice> decisionMix,
        List<SignalActivity> signalActivity,
        List<PaymentRow> exceptions,
        LedgerHealth ledgerHealth) {

    public OverviewReport {
        metrics = List.copyOf(metrics);
        throughput = List.copyOf(throughput);
        decisionMix = List.copyOf(decisionMix);
        signalActivity = List.copyOf(signalActivity);
        exceptions = List.copyOf(exceptions);
    }

    /**
     * A headline number with its own prior-period comparison. {@code deltaPercent} is null
     * when the prior window held no data, because "up 100%" from zero is not information.
     */
    public record Metric(
            String key,
            String label,
            String unit,
            double value,
            double previousValue,
            Double deltaPercent,
            /** Whether a rise is an improvement. Falling manual review is good news. */
            boolean preferHigher,
            String caption) {}

    public record ThroughputBucket(
            Instant startsAt,
            String label,
            long approved,
            long review,
            long rejected,
            long pending,
            long volumeMinor) {}

    public record DecisionSlice(String key, String label, long count, double share) {}

    public record SignalActivity(
            String code, String label, long count, long previousCount, double share) {}

    public record LedgerHealth(
            long journals,
            long balancedJournals,
            long postedVolumeMinor,
            String currency,
            Instant lastPostedAt) {}
}
