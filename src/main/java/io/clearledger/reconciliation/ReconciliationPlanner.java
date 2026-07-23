package io.clearledger.reconciliation;

import io.clearledger.payment.PaymentStatus;
import io.clearledger.risk.RiskDecision;

public final class ReconciliationPlanner {

    public ReconciliationAction plan(ReconciliationFacts facts) {
        if (facts.paymentStatus() != PaymentStatus.PENDING) {
            return ReconciliationAction.NO_OP;
        }
        if (facts.journalPresent()
                && (!facts.balancedJournal() || !facts.journalMatchesPayment())) {
            return ReconciliationAction.FLAG_MANUAL_REVIEW;
        }
        if (facts.riskDecision() == RiskDecision.APPROVED) {
            return facts.journalPresent()
                    ? ReconciliationAction.FINALIZE_APPROVED
                    : ReconciliationAction.FLAG_MANUAL_REVIEW;
        }
        return facts.journalPresent()
                ? ReconciliationAction.FLAG_MANUAL_REVIEW
                : ReconciliationAction.FINALIZE_DECISION;
    }
}
