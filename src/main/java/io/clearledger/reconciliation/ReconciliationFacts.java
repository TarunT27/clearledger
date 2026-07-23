package io.clearledger.reconciliation;

import io.clearledger.payment.PaymentStatus;
import io.clearledger.risk.RiskDecision;

public record ReconciliationFacts(
        PaymentStatus paymentStatus,
        RiskDecision riskDecision,
        boolean balancedJournal,
        boolean journalMatchesPayment,
        boolean journalPresent) {}
