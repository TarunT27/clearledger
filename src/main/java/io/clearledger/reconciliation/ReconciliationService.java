package io.clearledger.reconciliation;

import io.clearledger.audit.AuditService;
import io.clearledger.ledger.JournalSnapshot;
import io.clearledger.ledger.JournalVerification;
import io.clearledger.ledger.JournalVerifier;
import io.clearledger.ledger.LedgerService;
import io.clearledger.payment.PaymentEntity;
import io.clearledger.payment.PaymentNotFoundException;
import io.clearledger.payment.PaymentRepository;
import io.clearledger.payment.PaymentStatus;
import io.clearledger.risk.RiskDecision;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
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
    private final ReconciliationRunRepository runs;
    private final Clock clock;
    private final Counter repairCounter;

    public ReconciliationService(
            PaymentRepository payments,
            LedgerService ledger,
            JournalVerifier verifier,
            ReconciliationPlanner planner,
            AuditService audit,
            ReconciliationRunRepository runs,
            Clock clock,
            MeterRegistry registry) {
        this.payments = payments;
        this.ledger = ledger;
        this.verifier = verifier;
        this.planner = planner;
        this.audit = audit;
        this.runs = runs;
        this.clock = clock;
        this.repairCounter = registry.counter("clearledger.reconciliation.repairs");
    }

    @Transactional
    public ReconciliationRun reconcile() {
        return reconcile(ReconciliationTrigger.SCHEDULED);
    }

    @Transactional
    public ReconciliationRun reconcile(ReconciliationTrigger trigger) {
        Instant startedAt = clock.instant();
        int scanned = 0;
        int repaired = 0;
        int flagged = 0;
        Instant staleBefore = startedAt.minus(STALE_PENDING_AGE);
        for (PaymentEntity payment : payments.findPendingForReconciliation(staleBefore)) {
            scanned++;
            switch (apply(payment)) {
                case FINALIZE_APPROVED, FINALIZE_DECISION -> repaired++;
                case FLAG_MANUAL_REVIEW -> flagged++;
                case NO_OP -> {
                    // The locked query currently returns only pending rows.
                }
            }
        }
        if (repaired > 0) {
            repairCounter.increment(repaired);
        }
        log.info(
                "Reconciliation completed trigger={} scanned={} repaired={} flagged={}",
                trigger,
                scanned,
                repaired,
                flagged);
        return record(startedAt, scanned, repaired, flagged, trigger);
    }

    /**
     * Repairs exactly one case, the way an operator does it from the console.
     *
     * <p>This is the same decision path as the sweep, and it is deliberately not a retry:
     * the row is re-read under a lock, the committed journal is verified, and the status
     * moves only if the row is still {@code PENDING}. A concurrent sweep that wins the race
     * leaves nothing to do, which the outcome reports as {@code alreadyResolved}.
     */
    @Transactional
    public RepairOutcome repair(UUID paymentId) {
        Instant startedAt = clock.instant();
        PaymentEntity payment =
                payments.findById(paymentId)
                        .orElseThrow(() -> new PaymentNotFoundException(paymentId));
        long observedVersion = payment.getVersion();
        if (payment.getStatus() != PaymentStatus.PENDING) {
            return new RepairOutcome(
                    paymentId,
                    ReconciliationAction.NO_OP,
                    payment.getStatus(),
                    observedVersion,
                    observedVersion,
                    true,
                    "Another worker finalized this payment first; no second write was made.");
        }
        ReconciliationAction action = apply(payment);
        if (action == ReconciliationAction.FINALIZE_APPROVED
                || action == ReconciliationAction.FINALIZE_DECISION) {
            repairCounter.increment();
        }
        record(
                startedAt,
                1,
                action == ReconciliationAction.FLAG_MANUAL_REVIEW ? 0 : 1,
                action == ReconciliationAction.FLAG_MANUAL_REVIEW ? 1 : 0,
                ReconciliationTrigger.TARGETED);
        return new RepairOutcome(
                paymentId,
                action,
                payment.getStatus(),
                observedVersion,
                observedVersion + 1,
                false,
                narrate(action));
    }

    /** Repairs and flags across every recorded run, as {@code [repaired, flagged]}. */
    @Transactional(readOnly = true)
    public long[] lifetimeTotals() {
        List<Object[]> rows = runs.totals();
        if (rows.isEmpty() || rows.get(0)[0] == null) {
            return new long[] {0, 0};
        }
        return new long[] {
            ((Number) rows.get(0)[0]).longValue(), ((Number) rows.get(0)[1]).longValue()
        };
    }

    @Transactional(readOnly = true)
    public List<ReconciliationRun> history(int limit) {
        return runs.findAllByOrderByStartedAtDesc(
                        PageRequest.of(0, Math.min(Math.max(limit, 1), 50)))
                .stream()
                .map(ReconciliationRunEntity::snapshot)
                .toList();
    }

    private ReconciliationAction apply(PaymentEntity payment) {
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
            }
            case FINALIZE_DECISION -> {
                PaymentStatus target = statusFor(payment.getRiskDecision());
                payment.finalizeAs(target, clock);
                audit.record(
                        payment.getId(),
                        "RECONCILIATION_FINALIZED",
                        "RECONCILER",
                        "Non-monetary risk decision finalized as " + target + ".");
            }
            case FLAG_MANUAL_REVIEW -> {
                payment.finalizeAs(PaymentStatus.REVIEW, clock);
                audit.record(
                        payment.getId(),
                        "RECONCILIATION_FLAGGED",
                        "RECONCILER",
                        "Journal absent, unbalanced, or inconsistent; no money was posted.");
            }
            case NO_OP -> {
                // Nothing to do for a payment that is already final.
            }
        }
        return action;
    }

    private ReconciliationRun record(
            Instant startedAt,
            int scanned,
            int repaired,
            int flagged,
            ReconciliationTrigger trigger) {
        ReconciliationRunEntity entity =
                runs.save(
                        new ReconciliationRunEntity(
                                UUID.randomUUID(),
                                startedAt,
                                clock.instant(),
                                scanned,
                                repaired,
                                flagged,
                                trigger));
        return entity.snapshot();
    }

    private String narrate(ReconciliationAction action) {
        return switch (action) {
            case FINALIZE_APPROVED ->
                    "Existing journal verified as balanced and matching; status finalized without a second journal.";
            case FINALIZE_DECISION ->
                    "No money was posted, so the recorded risk decision was applied directly.";
            case FLAG_MANUAL_REVIEW ->
                    "Journal evidence was inconsistent, so the payment was routed to manual review.";
            case NO_OP -> "The payment was already final.";
        };
    }

    private PaymentStatus statusFor(RiskDecision decision) {
        return switch (decision) {
            case APPROVED -> PaymentStatus.APPROVED;
            case REVIEW -> PaymentStatus.REVIEW;
            case REJECTED -> PaymentStatus.REJECTED;
        };
    }

    public record ReconciliationRun(
            UUID id,
            Instant startedAt,
            Instant completedAt,
            int scanned,
            int repaired,
            int flagged,
            ReconciliationTrigger trigger) {}

    /** What a single console-driven repair actually did. */
    public record RepairOutcome(
            UUID paymentId,
            ReconciliationAction action,
            PaymentStatus status,
            long observedVersion,
            long committedVersion,
            boolean alreadyResolved,
            String narrative) {}
}
