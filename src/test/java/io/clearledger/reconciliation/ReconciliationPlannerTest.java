package io.clearledger.reconciliation;

import static org.assertj.core.api.Assertions.assertThat;

import io.clearledger.payment.PaymentStatus;
import io.clearledger.risk.RiskDecision;
import org.junit.jupiter.api.Test;

class ReconciliationPlannerTest {

    private final ReconciliationPlanner planner = new ReconciliationPlanner();

    @Test
    void safelyFinalizesPendingPaymentWhenBalancedJournalProvesPostingCompleted() {
        ReconciliationFacts facts =
                new ReconciliationFacts(
                        PaymentStatus.PENDING, RiskDecision.APPROVED, true, true, true);

        assertThat(planner.plan(facts)).isEqualTo(ReconciliationAction.FINALIZE_APPROVED);
    }

    @Test
    void flagsMissingJournalInsteadOfCreatingMoneyDuringRepair() {
        ReconciliationFacts facts =
                new ReconciliationFacts(
                        PaymentStatus.PENDING, RiskDecision.APPROVED, false, false, false);

        assertThat(planner.plan(facts)).isEqualTo(ReconciliationAction.FLAG_MANUAL_REVIEW);
    }

    @Test
    void finalizesPersistedNonMonetaryDecisionWhenNoJournalExists() {
        ReconciliationFacts facts =
                new ReconciliationFacts(
                        PaymentStatus.PENDING, RiskDecision.REVIEW, false, false, false);

        assertThat(planner.plan(facts)).isEqualTo(ReconciliationAction.FINALIZE_DECISION);
    }

    @Test
    void ignoresAlreadyConsistentTerminalPayment() {
        ReconciliationFacts facts =
                new ReconciliationFacts(
                        PaymentStatus.APPROVED, RiskDecision.APPROVED, true, true, true);

        assertThat(planner.plan(facts)).isEqualTo(ReconciliationAction.NO_OP);
    }

    @Test
    void flagsMismatchedJournalForHumanReview() {
        ReconciliationFacts facts =
                new ReconciliationFacts(
                        PaymentStatus.PENDING, RiskDecision.APPROVED, true, false, true);

        assertThat(planner.plan(facts)).isEqualTo(ReconciliationAction.FLAG_MANUAL_REVIEW);
    }
}
