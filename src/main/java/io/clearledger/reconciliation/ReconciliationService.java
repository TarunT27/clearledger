package io.clearledger.reconciliation;

import io.clearledger.audit.AuditService;
import io.clearledger.ledger.JournalSnapshot;
import io.clearledger.ledger.JournalVerification;
import io.clearledger.ledger.JournalVerifier;
import io.clearledger.ledger.LedgerService;
import io.clearledger.payment.PaymentEntity;
import io.clearledger.payment.PaymentRepository;
import io.clearledger.payment.PaymentStatus;
import io.clearledger.risk.RiskDecision;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ReconciliationService {
    private static final Logger log = LoggerFactory.getLogger(ReconciliationService.class);
    private static final Duration STALE_PENDING_AGE = Duration.ofSeconds(30);

    private final PaymentRepository payments;
    private final LedgerService ledger;
    private final JournalVerifier verifier;
    private final ReconciliationPlanner planner;
    private final AuditService audit;
    private final Clock clock;
    private final Counter repairCounter;

    public ReconciliationService(
            PaymentRepository payments,
            LedgerService ledger,
            JournalVerifier verifier,
            ReconciliationPlanner planner,
            AuditService audit,
            Clock clock,
            MeterRegistry registry) {
        this.payments = payments;
        this.ledger = ledger;
        this.verifier = verifier;
        this.planner = planner;
        this.audit = audit;
        this.clock = clock;
        this.repairCounter = registry.counter("clearledger.reconciliation.repairs");
    }

    @Transactional
    public ReconciliationRun reconcile() {
        Instant startedAt = clock.instant();
        int scanned = 0;
        int repaired = 0;
        int flagged = 0;
        Instant staleBefore = startedAt.minus(STALE_PENDING_AGE);
        for (PaymentEntity payment : payments.findPendingForReconciliation(staleBefore)) {
            scanned++;
            Optional<JournalSnapshot> journal = ledger.findByPaymentId(payment.getId());
            JournalVerification verification =
                    journal.map(value -> verifier.verify(payment.snapshot(), value))
                            .orElse(new JournalVerification(false, false));
            ReconciliationAction action =
                    planner.plan(
                            new ReconciliationFacts(
                                    payment.getStatus(),
                                    payment.getRiskDecision(),
                                    verification.balanced(),
                                    verification.matchesPayment(),
                                    journal.isPresent()));
            switch (action) {
                case FINALIZE_APPROVED -> {
                    payment.finalizeAs(PaymentStatus.APPROVED, clock);
                    audit.record(
                            payment.getId(),
                            "RECONCILIATION_REPAIRED",
                            "RECONCILER",
                            "Balanced matching journal proved posting; finalized APPROVED.");
                    repaired++;
                }
                case FINALIZE_DECISION -> {
                    PaymentStatus target = statusFor(payment.getRiskDecision());
                    payment.finalizeAs(target, clock);
                    audit.record(
                            payment.getId(),
                            "RECONCILIATION_FINALIZED",
                            "RECONCILER",
                            "Non-monetary risk decision finalized as " + target + ".");
                    repaired++;
                }
                case FLAG_MANUAL_REVIEW -> {
                    payment.finalizeAs(PaymentStatus.REVIEW, clock);
                    audit.record(
                            payment.getId(),
                            "RECONCILIATION_FLAGGED",
                            "RECONCILER",
                            "Journal absent, unbalanced, or inconsistent; no money was posted.");
                    flagged++;
                }
                case NO_OP -> {
                    // The locked query currently returns only pending rows.
                }
            }
        }
        if (repaired > 0) {
            repairCounter.increment(repaired);
        }
        log.info(
                "Reconciliation completed scanned={} repaired={} flagged={}",
                scanned,
                repaired,
                flagged);
        return new ReconciliationRun(startedAt, clock.instant(), scanned, repaired, flagged);
    }

    private PaymentStatus statusFor(RiskDecision decision) {
        return switch (decision) {
            case APPROVED -> PaymentStatus.APPROVED;
            case REVIEW -> PaymentStatus.REVIEW;
            case REJECTED -> PaymentStatus.REJECTED;
        };
    }

    public record ReconciliationRun(
            Instant startedAt, Instant completedAt, int scanned, int repaired, int flagged) {}
}
