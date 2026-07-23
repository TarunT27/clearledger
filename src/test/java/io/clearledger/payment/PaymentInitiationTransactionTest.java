package io.clearledger.payment;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.clearledger.audit.AuditService;
import io.clearledger.ledger.LedgerService;
import io.clearledger.risk.RiskAssessment;
import io.clearledger.risk.RiskDecision;
import io.clearledger.risk.RiskEngine;
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
import org.springframework.jdbc.core.JdbcTemplate;

@ExtendWith(MockitoExtension.class)
class PaymentInitiationTransactionTest {
    private static final Clock CLOCK =
            Clock.fixed(Instant.parse("2026-07-23T12:00:00Z"), ZoneOffset.UTC);
    @Mock JdbcTemplate jdbc;
    @Mock PaymentRepository payments;
    @Mock EstablishedRecipientRepository recipients;
    @Mock LedgerService ledger;
    @Mock AuditService audit;
    private PaymentInitiationTransaction transaction;

    @BeforeEach
    void setUp() {
        transaction =
                new PaymentInitiationTransaction(
                        jdbc,
                        payments,
                        recipients,
                        new RiskEngine(),
                        ledger,
                        audit,
                        CLOCK);
    }

    @Test
    void createsPendingPaymentAndPostsJournalForApprovedRisk() {
        CreatePaymentRequest request = request();
        when(payments.findBySenderIdAndIdempotencyKeyHash(
                        request.senderId(), "a".repeat(64)))
                .thenReturn(Optional.empty());
        when(payments.countBySenderIdAndCreatedAtAfter(any(), any())).thenReturn(0L);
        when(recipients.exists(request.senderId(), request.recipientId()))
                .thenReturn(true);
        when(payments.outgoingAmountSince(any(), any(), any())).thenReturn(0L);
        when(payments.save(any(PaymentEntity.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        PaymentInitiationTransaction.InitiationResult result =
                transaction.initiate(
                        request, "a".repeat(64), "b".repeat(64));

        assertThat(result.duplicate()).isFalse();
        assertThat(result.payment().riskDecision()).isEqualTo(RiskDecision.APPROVED);
        assertThat(result.payment().status()).isEqualTo(PaymentStatus.PENDING);
        verify(ledger).post(any(PaymentEntity.class));
    }

    @Test
    void returnsOriginalForMatchingReplay() {
        CreatePaymentRequest request = request();
        PaymentEntity existing = entity(request, "b".repeat(64));
        when(payments.findBySenderIdAndIdempotencyKeyHash(
                        request.senderId(), "a".repeat(64)))
                .thenReturn(Optional.of(existing));

        PaymentInitiationTransaction.InitiationResult result =
                transaction.initiate(
                        request, "a".repeat(64), "b".repeat(64));

        assertThat(result.duplicate()).isTrue();
        assertThat(result.payment().id()).isEqualTo(existing.getId());
    }

    @Test
    void rejectsReplayWhenPayloadFingerprintChanged() {
        CreatePaymentRequest request = request();
        PaymentEntity existing = entity(request, "c".repeat(64));
        when(payments.findBySenderIdAndIdempotencyKeyHash(
                        request.senderId(), "a".repeat(64)))
                .thenReturn(Optional.of(existing));

        assertThatThrownBy(
                        () ->
                                transaction.initiate(
                                        request,
                                        "a".repeat(64),
                                        "b".repeat(64)))
                .isInstanceOf(IdempotencyConflictException.class);
    }

    private CreatePaymentRequest request() {
        return new CreatePaymentRequest(
                UUID.randomUUID(), UUID.randomUUID(), 7_500, "USD", "Initiation test");
    }

    private PaymentEntity entity(CreatePaymentRequest request, String fingerprint) {
        return PaymentEntity.pending(
                UUID.randomUUID(),
                request,
                "a".repeat(64),
                fingerprint,
                new RiskAssessment(RiskDecision.APPROVED, 0, List.of()),
                CLOCK);
    }
}
