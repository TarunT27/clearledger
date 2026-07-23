package io.clearledger.payment;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

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
import org.springframework.data.domain.Pageable;

@ExtendWith(MockitoExtension.class)
class PaymentServiceTest {
    private static final Clock CLOCK =
            Clock.fixed(Instant.parse("2026-07-23T12:00:00Z"), ZoneOffset.UTC);

    @Mock PaymentRepository repository;
    @Mock PaymentInitiationTransaction initiation;
    @Mock PaymentFinalizationTransaction finalization;
    private PaymentService service;

    @BeforeEach
    void setUp() {
        service =
                new PaymentService(
                        repository,
                        initiation,
                        finalization,
                        CLOCK,
                        new SimpleMeterRegistry());
    }

    @Test
    void finalizesNewlyInitiatedPayment() {
        PaymentSnapshot pending = snapshot(PaymentStatus.PENDING);
        PaymentSnapshot approved = snapshot(PaymentStatus.APPROVED);
        when(initiation.initiate(any(), anyString(), anyString()))
                .thenReturn(
                        new PaymentInitiationTransaction.InitiationResult(
                                pending, false));
        when(finalization.finalizeDecision(pending.id())).thenReturn(approved);

        PaymentCreationResult result =
                service.create(request(), "valid-key-123", ProcessingFault.NONE);

        assertThat(result).isEqualTo(new PaymentCreationResult(approved, false));
        verify(finalization).finalizeDecision(pending.id());
    }

    @Test
    void returnsReplayWithoutFinalizingAgain() {
        PaymentSnapshot approved = snapshot(PaymentStatus.APPROVED);
        when(initiation.initiate(any(), anyString(), anyString()))
                .thenReturn(
                        new PaymentInitiationTransaction.InitiationResult(
                                approved, true));

        PaymentCreationResult result =
                service.create(request(), "valid-key-123", ProcessingFault.NONE);

        assertThat(result.duplicate()).isTrue();
        assertThat(result.payment()).isEqualTo(approved);
    }

    @Test
    void injectsTimeoutOnlyAfterInitiationReturns() {
        PaymentSnapshot pending = snapshot(PaymentStatus.PENDING);
        when(initiation.initiate(any(), anyString(), anyString()))
                .thenReturn(
                        new PaymentInitiationTransaction.InitiationResult(
                                pending, false));

        assertThatThrownBy(
                        () ->
                                service.create(
                                        request(),
                                        "valid-key-123",
                                        ProcessingFault.AFTER_LEDGER_COMMIT))
                .isInstanceOf(SimulatedTimeoutException.class)
                .extracting("paymentId")
                .isEqualTo(pending.id());
        verify(finalization).markForReconciliation(pending.id());
    }

    @Test
    void rejectsUnsafeIdempotencyKeys() {
        assertThatThrownBy(
                        () ->
                                service.create(
                                        request(), " short ", ProcessingFault.NONE))
                .isInstanceOf(InvalidIdempotencyKeyException.class);
        assertThatThrownBy(
                        () -> service.create(request(), null, ProcessingFault.NONE))
                .isInstanceOf(InvalidIdempotencyKeyException.class);
    }

    @Test
    void getsAndListsPaymentSnapshots() {
        PaymentEntity entity = entity();
        when(repository.findById(entity.getId())).thenReturn(Optional.of(entity));
        when(repository.findAllByOrderByCreatedAtDesc(any(Pageable.class)))
                .thenReturn(List.of(entity));
        when(repository.findByStatusOrderByCreatedAtDesc(
                        any(PaymentStatus.class), any(Pageable.class)))
                .thenReturn(List.of(entity));

        assertThat(service.get(entity.getId()).id()).isEqualTo(entity.getId());
        assertThat(service.list(null, 500)).hasSize(1);
        assertThat(service.list(PaymentStatus.PENDING, 0)).hasSize(1);
        assertThatThrownBy(() -> service.get(UUID.randomUUID()))
                .isInstanceOf(PaymentNotFoundException.class);
    }

    @Test
    void buildsDashboardSummaryFromRepositoryAggregates() {
        when(repository.count()).thenReturn(10L);
        when(repository.countByStatus(PaymentStatus.APPROVED)).thenReturn(7L);
        when(repository.countByStatus(PaymentStatus.REVIEW)).thenReturn(1L);
        when(repository.countByStatus(PaymentStatus.REJECTED)).thenReturn(1L);
        when(repository.countByStatus(PaymentStatus.PENDING)).thenReturn(1L);
        when(repository.volumeSince(any())).thenReturn(123_456L);

        PaymentService.DashboardSummary summary = service.dashboard();

        assertThat(summary.approvalRate()).isEqualTo(70.0);
        assertThat(summary.volumeTodayMinor()).isEqualTo(123_456);
        assertThat(summary.totalPayments()).isEqualTo(10);
    }

    private CreatePaymentRequest request() {
        return new CreatePaymentRequest(
                UUID.randomUUID(), UUID.randomUUID(), 25_000, "USD", "Invoice");
    }

    private PaymentEntity entity() {
        CreatePaymentRequest request = request();
        return PaymentEntity.pending(
                UUID.randomUUID(),
                request,
                "a".repeat(64),
                "b".repeat(64),
                new io.clearledger.risk.RiskAssessment(
                        RiskDecision.APPROVED, 0, List.of()),
                CLOCK);
    }

    private PaymentSnapshot snapshot(PaymentStatus status) {
        PaymentEntity entity = entity();
        if (status != PaymentStatus.PENDING) {
            entity.finalizeAs(status, CLOCK);
        }
        return entity.snapshot();
    }
}
