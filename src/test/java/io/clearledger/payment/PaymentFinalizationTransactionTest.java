package io.clearledger.payment;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.clearledger.audit.AuditService;
import io.clearledger.risk.RiskAssessment;
import io.clearledger.risk.RiskDecision;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class PaymentFinalizationTransactionTest {
    private static final Clock CLOCK =
            Clock.fixed(Instant.parse("2026-07-23T12:00:00Z"), ZoneOffset.UTC);
    @Mock PaymentRepository payments;
    @Mock AuditService audit;

    @Test
    void mapsRiskDecisionToTerminalPaymentStatus() {
        PaymentEntity payment = pending(RiskDecision.REJECTED);
        when(payments.findById(payment.getId())).thenReturn(Optional.of(payment));
        PaymentFinalizationTransaction transaction =
                new PaymentFinalizationTransaction(payments, audit, CLOCK);

        PaymentSnapshot result = transaction.finalizeDecision(payment.getId());

        assertThat(result.status()).isEqualTo(PaymentStatus.REJECTED);
        verify(audit)
                .record(
                        payment.getId(),
                        "PAYMENT_FINALIZED",
                        "PAYMENT_PROCESSOR",
                        "Status changed to REJECTED.");
    }

    @Test
    void terminalPaymentIsReturnedUnchanged() {
        PaymentEntity payment = pending(RiskDecision.REVIEW);
        payment.finalizeAs(PaymentStatus.REVIEW, CLOCK);
        when(payments.findById(payment.getId())).thenReturn(Optional.of(payment));

        PaymentSnapshot result =
                new PaymentFinalizationTransaction(payments, audit, CLOCK)
                        .finalizeDecision(payment.getId());

        assertThat(result.status()).isEqualTo(PaymentStatus.REVIEW);
    }

    private PaymentEntity pending(RiskDecision decision) {
        return PaymentEntity.pending(
                UUID.randomUUID(),
                new CreatePaymentRequest(
                        UUID.randomUUID(),
                        UUID.randomUUID(),
                        1_000,
                        "USD",
                        "Test"),
                "a".repeat(64),
                "b".repeat(64),
                new RiskAssessment(decision, 0, List.of()),
                CLOCK);
    }
}
