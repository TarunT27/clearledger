package io.clearledger.payment;

import io.clearledger.risk.RiskAssessment;
import io.clearledger.risk.RiskDecision;
import io.clearledger.risk.RiskSignal;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.Clock;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "payments")
public class PaymentEntity {

    @Id private UUID id;
    @Column(name = "sender_id", nullable = false) private UUID senderId;
    @Column(name = "recipient_id", nullable = false) private UUID recipientId;
    @Column(name = "amount_minor", nullable = false) private long amountMinor;
    @Column(nullable = false, length = 3) private String currency;
    @Column(nullable = false, length = 140) private String description;
    @Enumerated(EnumType.STRING) @Column(nullable = false) private PaymentStatus status;
    @Enumerated(EnumType.STRING) @Column(name = "risk_decision", nullable = false)
    private RiskDecision riskDecision;
    @Column(name = "risk_score", nullable = false) private int riskScore;
    @Column(name = "risk_signals", nullable = false, length = 512) private String riskSignals;
    @Column(name = "idempotency_key_hash", nullable = false, length = 64)
    private String idempotencyKeyHash;
    @Column(name = "request_fingerprint", nullable = false, length = 64)
    private String requestFingerprint;
    @Column(name = "created_at", nullable = false) private Instant createdAt;
    @Column(name = "updated_at", nullable = false) private Instant updatedAt;
    @Column(name = "reconciliation_required", nullable = false)
    private boolean reconciliationRequired;
    @Version private long version;

    protected PaymentEntity() {}

    public static PaymentEntity pending(
            UUID id,
            CreatePaymentRequest request,
            String keyHash,
            String fingerprint,
            RiskAssessment assessment,
            Clock clock) {
        PaymentEntity payment = new PaymentEntity();
        payment.id = id;
        payment.senderId = request.senderId();
        payment.recipientId = request.recipientId();
        payment.amountMinor = request.amountMinor();
        payment.currency = request.currency();
        payment.description = request.description();
        payment.status = PaymentStatus.PENDING;
        payment.riskDecision = assessment.decision();
        payment.riskScore = assessment.score();
        payment.riskSignals =
                assessment.signals().stream()
                        .filter(RiskSignal::triggered)
                        .map(RiskSignal::code)
                        .sorted()
                        .reduce((left, right) -> left + "," + right)
                        .orElse("");
        payment.idempotencyKeyHash = keyHash;
        payment.requestFingerprint = fingerprint;
        payment.createdAt = clock.instant();
        payment.updatedAt = payment.createdAt;
        payment.reconciliationRequired = false;
        return payment;
    }

    public void finalizeAs(PaymentStatus target, Clock clock) {
        status = PaymentStateMachine.transition(status, target);
        updatedAt = clock.instant();
        reconciliationRequired = false;
    }

    public void markReconciliationRequired(Clock clock) {
        if (status == PaymentStatus.PENDING) {
            reconciliationRequired = true;
            updatedAt = clock.instant();
        }
    }

    public UUID getId() { return id; }
    public UUID getSenderId() { return senderId; }
    public UUID getRecipientId() { return recipientId; }
    public long getAmountMinor() { return amountMinor; }
    public String getCurrency() { return currency; }
    public PaymentStatus getStatus() { return status; }
    public RiskDecision getRiskDecision() { return riskDecision; }
    public String getRequestFingerprint() { return requestFingerprint; }
    public Instant getCreatedAt() { return createdAt; }

    public PaymentSnapshot snapshot() {
        List<RiskSignal> signals =
                riskSignals.isBlank()
                        ? List.of()
                        : Arrays.stream(riskSignals.split(","))
                                .map(code -> new RiskSignal(code, true, signalScore(code), explanation(code)))
                                .toList();
        return new PaymentSnapshot(
                id, senderId, recipientId, amountMinor, currency, description, status,
                riskDecision, riskScore, signals, createdAt, updatedAt);
    }

    private int signalScore(String code) {
        return switch (code) {
            case "UNUSUAL_AMOUNT" -> 50;
            case "REPEATED_ATTEMPTS" -> 45;
            case "NEW_RECIPIENT" -> 40;
            case "VELOCITY_LIMIT" -> 100;
            default -> 0;
        };
    }

    private String explanation(String code) {
        return switch (code) {
            case "UNUSUAL_AMOUNT" -> "Amount meets or exceeds the unusual-payment threshold.";
            case "REPEATED_ATTEMPTS" -> "Repeated distinct payment attempts were observed.";
            case "NEW_RECIPIENT" -> "No earlier approved payment to this recipient was found.";
            case "VELOCITY_LIMIT" -> "The sender would exceed the rolling outgoing limit.";
            default -> "Risk signal recorded.";
        };
    }
}
