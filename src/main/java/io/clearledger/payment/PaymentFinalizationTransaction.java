package io.clearledger.payment;

import io.clearledger.audit.AuditService;
import io.clearledger.risk.RiskDecision;
import java.time.Clock;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PaymentFinalizationTransaction {
    private final PaymentRepository payments;
    private final AuditService audit;
    private final Clock clock;

    public PaymentFinalizationTransaction(
            PaymentRepository payments, AuditService audit, Clock clock) {
        this.payments = payments;
        this.audit = audit;
        this.clock = clock;
    }

    @Transactional
    public PaymentSnapshot finalizeDecision(UUID paymentId) {
        PaymentEntity payment =
                payments.findById(paymentId).orElseThrow(() -> new PaymentNotFoundException(paymentId));
        if (payment.getStatus() != PaymentStatus.PENDING) {
            return payment.snapshot();
        }
        PaymentStatus target = statusFor(payment.getRiskDecision());
        payment.finalizeAs(target, clock);
        audit.record(
                paymentId,
                "PAYMENT_FINALIZED",
                "PAYMENT_PROCESSOR",
                "Status changed to " + target + ".");
        return payment.snapshot();
    }

    @Transactional
    public void markForReconciliation(UUID paymentId) {
        PaymentEntity payment =
                payments.findById(paymentId).orElseThrow(() -> new PaymentNotFoundException(paymentId));
        payment.markReconciliationRequired(clock);
        audit.record(
                paymentId,
                "RECONCILIATION_REQUIRED",
                "PAYMENT_PROCESSOR",
                "Final status was not observed after the committed initiation.");
    }

    private PaymentStatus statusFor(RiskDecision decision) {
        return switch (decision) {
            case APPROVED -> PaymentStatus.APPROVED;
            case REVIEW -> PaymentStatus.REVIEW;
            case REJECTED -> PaymentStatus.REJECTED;
        };
    }
}
