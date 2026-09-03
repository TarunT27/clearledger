package io.clearledger.console;

import java.util.List;

/** Everything the evidence drawer shows for one payment. */
public record PaymentDetail(
        PaymentRow payment,
        List<RiskSignalDetail> riskSignals,
        JournalView journal,
        List<AuditEventView> audit) {

    public PaymentDetail {
        riskSignals = List.copyOf(riskSignals);
        audit = List.copyOf(audit);
    }

    /** A rule the engine evaluated, whether or not it fired. */
    public record RiskSignalDetail(
            String code, String label, String explanation, int score, boolean triggered) {}
}
