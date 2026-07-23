package io.clearledger.payment;

import io.clearledger.audit.AuditService;
import io.clearledger.ledger.LedgerService;
import io.clearledger.risk.RiskAssessment;
import io.clearledger.risk.RiskContext;
import io.clearledger.risk.RiskDecision;
import io.clearledger.risk.RiskEngine;
import java.time.Clock;
import java.time.Duration;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PaymentInitiationTransaction {
    private static final Duration ATTEMPT_WINDOW = Duration.ofMinutes(10);
    private static final Duration VELOCITY_WINDOW = Duration.ofHours(1);

    private final JdbcTemplate jdbc;
    private final PaymentRepository payments;
    private final EstablishedRecipientRepository recipients;
    private final RiskEngine riskEngine;
    private final LedgerService ledger;
    private final AuditService audit;
    private final Clock clock;

    public PaymentInitiationTransaction(
            JdbcTemplate jdbc,
            PaymentRepository payments,
            EstablishedRecipientRepository recipients,
            RiskEngine riskEngine,
            LedgerService ledger,
            AuditService audit,
            Clock clock) {
        this.jdbc = jdbc;
        this.payments = payments;
        this.recipients = recipients;
        this.riskEngine = riskEngine;
        this.ledger = ledger;
        this.audit = audit;
        this.clock = clock;
    }

    @Transactional
    public InitiationResult initiate(
            CreatePaymentRequest request, String keyHash, String fingerprint) {
        acquireSenderLock(request.senderId());
        var existing = payments.findBySenderIdAndIdempotencyKeyHash(request.senderId(), keyHash);
        if (existing.isPresent()) {
            if (!existing.get().getRequestFingerprint().equals(fingerprint)) {
                throw new IdempotencyConflictException();
            }
            audit.record(existing.get().getId(), "IDEMPOTENT_REPLAY", "PAYMENT_API", "Original result returned.");
            return new InitiationResult(existing.get().snapshot(), true);
        }

        RiskAssessment risk = riskEngine.assess(context(request));
        PaymentEntity payment =
                payments.save(
                        PaymentEntity.pending(
                                UUID.randomUUID(), request, keyHash, fingerprint, risk, clock));
        audit.record(
                payment.getId(),
                "PAYMENT_ACCEPTED",
                "PAYMENT_API",
                "Risk decision=" + risk.decision() + ", score=" + risk.score());
        if (risk.decision() == RiskDecision.APPROVED) {
            ledger.post(payment);
            audit.record(
                    payment.getId(),
                    "JOURNAL_POSTED",
                    "LEDGER",
                    "Balanced debit and credit entries committed.");
        }
        return new InitiationResult(payment.snapshot(), false);
    }

    private RiskContext context(CreatePaymentRequest request) {
        int attempts =
                Math.toIntExact(
                        payments.countBySenderIdAndCreatedAtAfter(
                                request.senderId(), clock.instant().minus(ATTEMPT_WINDOW)));
        boolean established =
                recipients.exists(request.senderId(), request.recipientId())
                        || payments.existsBySenderIdAndRecipientIdAndStatus(
                                request.senderId(), request.recipientId(), PaymentStatus.APPROVED);
        long velocity =
                payments.outgoingAmountSince(
                        request.senderId(),
                        clock.instant().minus(VELOCITY_WINDOW),
                        RiskDecision.APPROVED);
        return new RiskContext(request.amountMinor(), attempts, established, velocity);
    }

    private void acquireSenderLock(UUID senderId) {
        jdbc.update(
                """
                insert into sender_locks(sender_id, touched_at)
                values (?, current_timestamp)
                on conflict (sender_id) do update set touched_at = excluded.touched_at
                """,
                senderId);
        jdbc.queryForObject(
                "select sender_id from sender_locks where sender_id = ? for update",
                (resultSet, rowNumber) -> resultSet.getObject(1, UUID.class),
                senderId);
    }

    public record InitiationResult(PaymentSnapshot payment, boolean duplicate) {}
}
