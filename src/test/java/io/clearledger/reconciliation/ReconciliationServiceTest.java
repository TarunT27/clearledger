package io.clearledger.reconciliation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.ArgumentMatchers.any;

import io.clearledger.audit.AuditService;
import io.clearledger.ledger.EntryDirection;
import io.clearledger.ledger.JournalLineSnapshot;
import io.clearledger.ledger.JournalSnapshot;
import io.clearledger.ledger.JournalVerifier;
import io.clearledger.ledger.LedgerService;
import io.clearledger.payment.CreatePaymentRequest;
import io.clearledger.payment.PaymentEntity;
import io.clearledger.payment.PaymentRepository;
import io.clearledger.payment.PaymentStatus;
import io.clearledger.risk.RiskAssessment;
import io.clearledger.risk.RiskDecision;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class ReconciliationServiceTest {
    private static final Clock CLOCK =
            Clock.fixed(Instant.parse("2026-07-23T12:00:00Z"), ZoneOffset.UTC);
    @Mock PaymentRepository payments;
    @Mock LedgerService ledger;
    @Mock AuditService audit;
    @Mock ReconciliationRunRepository runs;
    private ReconciliationService service;

    @BeforeEach
    void setUp() {
        when(runs.save(any(ReconciliationRunEntity.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        service =
                new ReconciliationService(
                        payments,
                        ledger,
                        new JournalVerifier(),
                        new ReconciliationPlanner(),
                        audit,
                        runs,
                        CLOCK,
                        new SimpleMeterRegistry());
    }

    @Test
    void repairsPendingApprovedPaymentOnlyWhenJournalMatches() {
        PaymentEntity payment = payment(RiskDecision.APPROVED);
        when(payments.findPendingForReconciliation(any(Instant.class))).thenReturn(List.of(payment));
        when(ledger.findByPaymentId(payment.getId()))
                .thenReturn(Optional.of(matchingJournal(payment)));

        ReconciliationService.ReconciliationRun run = service.reconcile();

        assertThat(run.repaired()).isOne();
        assertThat(payment.getStatus()).isEqualTo(PaymentStatus.APPROVED);
        verify(audit)
                .record(
                        payment.getId(),
                        "RECONCILIATION_REPAIRED",
                        "RECONCILER",
                        "Balanced matching journal proved posting; finalized APPROVED.");
    }

    @Test
    void flagsApprovedPaymentWhenJournalIsMissingWithoutPostingMoney() {
        PaymentEntity payment = payment(RiskDecision.APPROVED);
        when(payments.findPendingForReconciliation(any(Instant.class))).thenReturn(List.of(payment));
        when(ledger.findByPaymentId(payment.getId())).thenReturn(Optional.empty());

        ReconciliationService.ReconciliationRun run = service.reconcile();

        assertThat(run.flagged()).isOne();
        assertThat(payment.getStatus()).isEqualTo(PaymentStatus.REVIEW);
    }

    @Test
    void finalizesNonMonetaryPersistedRiskDecision() {
        PaymentEntity payment = payment(RiskDecision.REJECTED);
        when(payments.findPendingForReconciliation(any(Instant.class))).thenReturn(List.of(payment));
        when(ledger.findByPaymentId(payment.getId())).thenReturn(Optional.empty());

        ReconciliationService.ReconciliationRun run = service.reconcile();

        assertThat(run.repaired()).isOne();
        assertThat(payment.getStatus()).isEqualTo(PaymentStatus.REJECTED);
    }

    private PaymentEntity payment(RiskDecision decision) {
        return PaymentEntity.pending(
                UUID.randomUUID(),
                new CreatePaymentRequest(
                        UUID.randomUUID(),
                        UUID.randomUUID(),
                        4_500,
                        "USD",
                        "Repair test"),
                "a".repeat(64),
                "b".repeat(64),
                new RiskAssessment(decision, 0, List.of()),
                CLOCK);
    }

    private JournalSnapshot matchingJournal(PaymentEntity payment) {
        return new JournalSnapshot(
                UUID.randomUUID(),
                payment.getId(),
                List.of(
                        new JournalLineSnapshot(
                                "CUSTOMER:" + payment.getSenderId(),
                                EntryDirection.DEBIT,
                                payment.getAmountMinor(),
                                payment.getCurrency()),
                        new JournalLineSnapshot(
                                "CUSTOMER:" + payment.getRecipientId(),
                                EntryDirection.CREDIT,
                                payment.getAmountMinor(),
                                payment.getCurrency())));
    }
}
