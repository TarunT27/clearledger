package io.clearledger.console;

import io.clearledger.audit.AuditEventEntity;
import io.clearledger.audit.AuditEventRepository;
import io.clearledger.console.OverviewReport.DecisionSlice;
import io.clearledger.console.OverviewReport.LedgerHealth;
import io.clearledger.console.OverviewReport.Metric;
import io.clearledger.console.OverviewReport.SignalActivity;
import io.clearledger.console.OverviewReport.ThroughputBucket;
import io.clearledger.counterparty.CounterpartyDirectory;
import io.clearledger.counterparty.CounterpartyRole;
import io.clearledger.counterparty.CounterpartySnapshot;
import io.clearledger.ledger.EntryDirection;
import io.clearledger.ledger.JournalEntity;
import io.clearledger.ledger.JournalEntryEntity;
import io.clearledger.ledger.JournalEntryRepository;
import io.clearledger.ledger.JournalRepository;
import io.clearledger.ledger.JournalVerification;
import io.clearledger.ledger.JournalVerifier;
import io.clearledger.payment.PaymentEntity;
import io.clearledger.payment.PaymentInitiationTransaction;
import io.clearledger.payment.PaymentNotFoundException;
import io.clearledger.payment.PaymentPulse;
import io.clearledger.payment.PaymentRepository;
import io.clearledger.payment.PaymentSnapshot;
import io.clearledger.payment.PaymentStatus;
import io.clearledger.reconciliation.ReconciliationAction;
import io.clearledger.reconciliation.ReconciliationFacts;
import io.clearledger.reconciliation.ReconciliationPlanner;
import io.clearledger.reconciliation.ReconciliationService;
import io.clearledger.risk.RiskEngine;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The read side of ClearLedger.
 *
 * <p>Every figure the console shows is derived here from the same tables the payment path
 * writes, so the console cannot claim something the ledger does not support. Nothing in
 * this class writes; the one console action that changes state, repairing a reconciliation
 * case, is delegated to {@link ReconciliationService} so it keeps the compare-and-swap
 * guarantees rather than getting a second, weaker implementation.
 */
@Service
@Transactional(readOnly = true)
public class ConsoleService {
    private static final int MAX_PAGE_SIZE = 100;
    private static final int EXCEPTION_PREVIEW_LIMIT = 6;
    private static final Duration CRITICAL_AGE = Duration.ofHours(4);
    private static final Duration HIGH_AGE = Duration.ofHours(1);
    /** Stands in for "no counterparty matched": an empty SQL {@code in ()} is not valid. */
    private static final UUID NO_MATCH = new UUID(0L, 0L);

    private final PaymentRepository payments;
    private final JournalRepository journals;
    private final JournalEntryRepository journalEntries;
    private final AuditEventRepository auditEvents;
    private final CounterpartyDirectory counterparties;
    private final JournalVerifier verifier;
    private final ReconciliationPlanner planner;
    private final ReconciliationService reconciliation;
    private final Clock clock;
    private final boolean workerEnabled;
    private final long workerIntervalMs;

    public ConsoleService(
            PaymentRepository payments,
            JournalRepository journals,
            JournalEntryRepository journalEntries,
            AuditEventRepository auditEvents,
            CounterpartyDirectory counterparties,
            JournalVerifier verifier,
            ReconciliationPlanner planner,
            ReconciliationService reconciliation,
            Clock clock,
            @Value("${clearledger.reconciliation.enabled:true}") boolean workerEnabled,
            @Value("${clearledger.reconciliation.fixed-delay-ms:30000}") long workerIntervalMs) {
        this.payments = payments;
        this.journals = journals;
        this.journalEntries = journalEntries;
        this.auditEvents = auditEvents;
        this.counterparties = counterparties;
        this.verifier = verifier;
        this.planner = planner;
        this.reconciliation = reconciliation;
        this.clock = clock;
        this.workerEnabled = workerEnabled;
        this.workerIntervalMs = workerIntervalMs;
    }

    // ---------------------------------------------------------------- payments

    public ConsolePage<PaymentRow> payments(PaymentQuery query, int page, int size) {
        Set<UUID> matchedParties =
                query.text() == null || query.text().isBlank()
                        ? Set.of()
                        : counterparties.idsMatching(query.text().strip());
        Pageable pageable = PageRequest.of(Math.max(page, 0), clampSize(size), query.toSort());
        Page<PaymentEntity> found =
                payments.findAll(query.toSpecification(matchedParties), pageable);
        return ConsolePage.of(found, rows(found.getContent()));
    }

    public PaymentDetail payment(UUID paymentId) {
        PaymentEntity payment =
                payments.findById(paymentId)
                        .orElseThrow(() -> new PaymentNotFoundException(paymentId));
        Map<UUID, CounterpartySnapshot> directory = counterparties.load();
        Optional<JournalEntity> journal = journals.findByPaymentId(paymentId);
        JournalView journalView =
                journal.map(entity -> journalView(entity, payment, directory)).orElse(null);
        return new PaymentDetail(
                row(payment, journal.map(JournalEntity::getId).orElse(null), directory),
                riskSignals(payment),
                journalView,
                auditEvents.findByPaymentIdOrderByCreatedAtAsc(paymentId).stream()
                        .map(event -> auditView(event, payment.getReference()))
                        .toList());
    }

    // ---------------------------------------------------------------- ledger

    public ConsolePage<JournalView> journals(String text, int page, int size) {
        Pageable pageable = PageRequest.of(Math.max(page, 0), clampSize(size));
        Page<JournalEntity> found = findJournals(text, pageable);
        Map<UUID, CounterpartySnapshot> directory = counterparties.load();
        Map<UUID, PaymentEntity> owners =
                payments
                        .findAllById(
                                found.getContent().stream().map(JournalEntity::getPaymentId).toList())
                        .stream()
                        .collect(Collectors.toMap(PaymentEntity::getId, entity -> entity));
        Map<UUID, List<JournalEntryEntity>> lines = linesByJournal(found.getContent());
        List<JournalView> views =
                found.getContent().stream()
                        .map(
                                entity ->
                                        journalView(
                                                entity,
                                                owners.get(entity.getPaymentId()),
                                                lines.getOrDefault(entity.getId(), List.of()),
                                                directory))
                        .toList();
        return ConsolePage.of(found, views);
    }

    private Page<JournalEntity> findJournals(String text, Pageable pageable) {
        if (text == null || text.isBlank()) {
            return journals.findAllByOrderByCreatedAtDesc(pageable);
        }
        Set<UUID> parties = counterparties.idsMatching(text.strip());
        return journals.search(
                "%" + text.strip().toLowerCase(Locale.ROOT) + "%",
                parties.isEmpty() ? Set.of(NO_MATCH) : parties,
                pageable);
    }

    // ---------------------------------------------------------------- audit

    public ConsolePage<AuditEventView> auditEvents(String text, String eventType, int page, int size) {
        Pageable pageable = PageRequest.of(Math.max(page, 0), clampSize(size));
        Page<AuditEventEntity> found =
                auditEvents.search(
                        eventType == null || eventType.isBlank() ? null : eventType,
                        text == null || text.isBlank()
                                ? null
                                : "%" + text.strip().toLowerCase(Locale.ROOT) + "%",
                        pageable);
        Map<UUID, String> references = referencesFor(found.getContent());
        return ConsolePage.of(
                found,
                found.getContent().stream()
                        .map(event -> auditView(event, references.get(event.getPaymentId())))
                        .toList());
    }

    public List<String> auditEventTypes() {
        return auditEvents.countByEventType().stream()
                .map(row -> (String) row[0])
                .sorted()
                .toList();
    }

    // ---------------------------------------------------------------- overview

    public OverviewReport overview(String rangeId) {
        ConsoleRange range = ConsoleRange.fromId(rangeId);
        Instant now = clock.instant();
        Instant windowStart = range.start(now);
        Instant priorStart = windowStart.minus(range.window());

        List<PaymentPulse> current = payments.pulseBetween(windowStart, now);
        List<PaymentPulse> prior = payments.pulseBetween(priorStart, windowStart);

        long openExceptions = payments.countByStatus(PaymentStatus.PENDING);
        List<Metric> metrics =
                List.of(
                        volumeMetric(current, prior),
                        approvalMetric(current, prior),
                        reviewMetric(current, prior),
                        new Metric(
                                "openExceptions",
                                "Open exceptions",
                                "count",
                                openExceptions,
                                openExceptions,
                                null,
                                false,
                                openExceptions == 0
                                        ? "Every payment has a final status"
                                        : "Pending payments awaiting reconciliation"));

        return new OverviewReport(
                range.id(),
                range.label(),
                now,
                windowStart,
                metrics,
                throughput(range, current, now),
                decisionMix(current),
                signalActivity(current, prior),
                exceptionPreview(),
                ledgerHealth());
    }

    // ---------------------------------------------------------------- risk

    public RiskReport risk(String rangeId) {
        ConsoleRange range = ConsoleRange.fromId(rangeId);
        Instant now = clock.instant();
        Instant windowStart = range.start(now);
        List<PaymentPulse> current = payments.pulseBetween(windowStart, now);
        List<PaymentPulse> prior =
                payments.pulseBetween(windowStart.minus(range.window()), windowStart);
        Map<UUID, CounterpartySnapshot> directory = counterparties.load();
        Pageable queueSize = PageRequest.of(0, 8);
        return new RiskReport(
                range.id(),
                range.label(),
                current.size(),
                payments.averageRiskScoreSince(windowStart),
                signalActivity(current, prior),
                decisionMix(current),
                rows(payments.findByStatusOrderByCreatedAtDesc(PaymentStatus.REVIEW, queueSize), directory),
                rows(payments.findByStatusOrderByCreatedAtDesc(PaymentStatus.REJECTED, queueSize), directory),
                new RiskReport.Policy(
                        RiskEngine.UNUSUAL_AMOUNT_MINOR,
                        RiskEngine.REPEATED_ATTEMPT_LIMIT,
                        RiskEngine.VELOCITY_LIMIT_MINOR,
                        RiskEngine.REVIEW_SCORE_THRESHOLD,
                        (int) PaymentInitiationTransaction.ATTEMPT_WINDOW.toMinutes(),
                        (int) PaymentInitiationTransaction.VELOCITY_WINDOW.toMinutes()));
    }

    // ---------------------------------------------------------------- reconciliation

    public ReconciliationBoard reconciliationBoard() {
        Instant now = clock.instant();
        List<PaymentEntity> pending =
                payments.findByStatusOrderByCreatedAtAsc(PaymentStatus.PENDING);
        Map<UUID, CounterpartySnapshot> directory = counterparties.load();
        Map<UUID, JournalEntity> journalsByPayment =
                journals.findByPaymentIdIn(pending.stream().map(PaymentEntity::getId).toList())
                        .stream()
                        .collect(Collectors.toMap(JournalEntity::getPaymentId, entity -> entity));
        Map<UUID, List<JournalEntryEntity>> lines = linesByJournal(journalsByPayment.values());
        Map<UUID, List<AuditEventEntity>> evidence =
                auditEvents
                        .findByPaymentIdInOrderByCreatedAtAsc(
                                pending.stream().map(PaymentEntity::getId).toList())
                        .stream()
                        .collect(Collectors.groupingBy(AuditEventEntity::getPaymentId));

        List<ReconciliationBoard.Case> cases = new ArrayList<>();
        long repairableNow = 0;
        long journalBacked = 0;
        for (PaymentEntity payment : pending) {
            JournalEntity journal = journalsByPayment.get(payment.getId());
            List<JournalEntryEntity> journalLines =
                    journal == null ? List.of() : lines.getOrDefault(journal.getId(), List.of());
            JournalView view =
                    journal == null ? null : journalView(journal, payment, journalLines, directory);
            JournalVerification verification =
                    view == null
                            ? new JournalVerification(false, false)
                            : new JournalVerification(view.balanced(), view.matchesPayment());
            ReconciliationAction planned =
                    planner.plan(
                            new ReconciliationFacts(
                                    payment.getStatus(),
                                    payment.getRiskDecision(),
                                    verification.balanced(),
                                    verification.matchesPayment(),
                                    journal != null));
            if (journal != null) {
                journalBacked++;
            }
            if (planned == ReconciliationAction.FINALIZE_APPROVED
                    || planned == ReconciliationAction.FINALIZE_DECISION) {
                repairableNow++;
            }
            long ageSeconds = Duration.between(payment.getCreatedAt(), now).getSeconds();
            cases.add(
                    new ReconciliationBoard.Case(
                            payment.getId(),
                            payment.getReference(),
                            CounterpartyDirectory.resolve(directory, payment.getSenderId()),
                            CounterpartyDirectory.resolve(directory, payment.getRecipientId()),
                            payment.getAmountMinor(),
                            payment.getCurrency(),
                            severity(ageSeconds, journal != null, verification),
                            reason(journal != null, verification),
                            payment.getCreatedAt(),
                            ageSeconds,
                            journal != null,
                            verification.balanced(),
                            verification.matchesPayment(),
                            payment.getVersion(),
                            planned,
                            strategy(planned),
                            view,
                            evidence.getOrDefault(payment.getId(), List.of()).stream()
                                    .map(event -> auditView(event, payment.getReference()))
                                    .toList()));
        }
        cases.sort(
                Comparator.comparingInt((ReconciliationBoard.Case item) -> severityRank(item.severity()))
                        .thenComparing(ReconciliationBoard.Case::detectedAt));

        List<ReconciliationService.ReconciliationRun> runs = reconciliation.history(12);
        long[] totals = reconciliation.lifetimeTotals();
        return new ReconciliationBoard(
                cases,
                runs,
                new ReconciliationBoard.Stats(
                        cases.size(),
                        journalBacked,
                        cases.size() - journalBacked,
                        repairableNow,
                        runs.isEmpty() ? null : runs.get(0).startedAt(),
                        totals[0],
                        totals[1],
                        workerEnabled,
                        workerIntervalMs),
                now);
    }

    @Transactional
    public ReconciliationService.RepairOutcome repair(UUID paymentId) {
        return reconciliation.repair(paymentId);
    }

    // ---------------------------------------------------------------- counterparties

    public List<CounterpartySnapshot> counterparties(CounterpartyRole role) {
        return counterparties.byRole(role);
    }

    // ---------------------------------------------------------------- helpers

    private List<PaymentRow> rows(List<PaymentEntity> entities) {
        return rows(entities, counterparties.load());
    }

    private List<PaymentRow> rows(
            List<PaymentEntity> entities, Map<UUID, CounterpartySnapshot> directory) {
        Map<UUID, UUID> journalIds =
                journals.findByPaymentIdIn(entities.stream().map(PaymentEntity::getId).toList())
                        .stream()
                        .collect(
                                Collectors.toMap(
                                        JournalEntity::getPaymentId, JournalEntity::getId));
        return entities.stream()
                .map(entity -> row(entity, journalIds.get(entity.getId()), directory))
                .toList();
    }

    private PaymentRow row(
            PaymentEntity payment, UUID journalId, Map<UUID, CounterpartySnapshot> directory) {
        PaymentSnapshot snapshot = payment.snapshot();
        return new PaymentRow(
                payment.getId(),
                payment.getReference(),
                CounterpartyDirectory.resolve(directory, payment.getSenderId()),
                CounterpartyDirectory.resolve(directory, payment.getRecipientId()),
                payment.getAmountMinor(),
                payment.getCurrency(),
                payment.getDescription(),
                payment.getStatus(),
                payment.getRiskDecision(),
                payment.getRiskScore(),
                snapshot.riskSignals().stream().map(signal -> signal.code()).toList(),
                journalId != null,
                journalId,
                payment.isReconciliationRequired(),
                payment.getVersion(),
                payment.getCreatedAt(),
                payment.getUpdatedAt());
    }

    private List<PaymentDetail.RiskSignalDetail> riskSignals(PaymentEntity payment) {
        Set<String> triggered =
                payment.snapshot().riskSignals().stream()
                        .map(signal -> signal.code())
                        .collect(Collectors.toSet());
        return ConsoleVocabulary.RISK_SIGNAL_CODES.stream()
                .map(
                        code ->
                                new PaymentDetail.RiskSignalDetail(
                                        code,
                                        ConsoleVocabulary.riskSignalLabel(code),
                                        ConsoleVocabulary.riskSignalExplanation(code),
                                        triggered.contains(code) ? signalScore(code) : 0,
                                        triggered.contains(code)))
                .toList();
    }

    private static int signalScore(String code) {
        return switch (code) {
            case "UNUSUAL_AMOUNT" -> 50;
            case "REPEATED_ATTEMPTS" -> 45;
            case "NEW_RECIPIENT" -> 40;
            case "VELOCITY_LIMIT" -> 100;
            default -> 0;
        };
    }

    private Map<UUID, List<JournalEntryEntity>> linesByJournal(
            java.util.Collection<JournalEntity> entities) {
        if (entities.isEmpty()) {
            return Map.of();
        }
        return journalEntries
                .findByJournalIdInOrderByDirectionAsc(
                        entities.stream().map(JournalEntity::getId).toList())
                .stream()
                .collect(Collectors.groupingBy(JournalEntryEntity::getJournalId));
    }

    private JournalView journalView(
            JournalEntity journal, PaymentEntity payment, Map<UUID, CounterpartySnapshot> directory) {
        return journalView(
                journal,
                payment,
                journalEntries.findByJournalIdOrderByDirectionAsc(journal.getId()),
                directory);
    }

    private JournalView journalView(
            JournalEntity journal,
            PaymentEntity payment,
            List<JournalEntryEntity> lines,
            Map<UUID, CounterpartySnapshot> directory) {
        long debits = sum(lines, EntryDirection.DEBIT);
        long credits = sum(lines, EntryDirection.CREDIT);
        JournalVerification verification =
                payment == null
                        ? new JournalVerification(debits > 0 && debits == credits, false)
                        : verifier.verify(
                                payment.snapshot(),
                                new io.clearledger.ledger.JournalSnapshot(
                                        journal.getId(),
                                        journal.getPaymentId(),
                                        lines.stream()
                                                .map(
                                                        line ->
                                                                new io.clearledger.ledger
                                                                        .JournalLineSnapshot(
                                                                        line.getAccountId(),
                                                                        line.getDirection(),
                                                                        line.getAmountMinor(),
                                                                        line.getCurrency()))
                                                .toList()));
        return new JournalView(
                journal.getId(),
                ConsoleVocabulary.journalReference(journal.getId()),
                journal.getPaymentId(),
                payment == null ? null : payment.getReference(),
                payment == null
                        ? null
                        : CounterpartyDirectory.resolve(directory, payment.getRecipientId())
                                .displayName(),
                journal.getCreatedAt(),
                lines.isEmpty() ? "USD" : lines.get(0).getCurrency(),
                debits,
                credits,
                debits > 0 && debits == credits,
                verification.matchesPayment(),
                lines.stream()
                        .map(line -> line(line, directory))
                        .toList());
    }

    private JournalView.Line line(
            JournalEntryEntity entry, Map<UUID, CounterpartySnapshot> directory) {
        return new JournalView.Line(
                entry.getAccountId(),
                accountLabel(entry.getAccountId(), directory),
                entry.getDirection(),
                entry.getAmountMinor(),
                entry.getCurrency());
    }

    /** Turns {@code CUSTOMER:<uuid>} into the counterparty's name where one is known. */
    private String accountLabel(String accountId, Map<UUID, CounterpartySnapshot> directory) {
        int separator = accountId.indexOf(':');
        if (separator < 0) {
            return accountId;
        }
        try {
            UUID owner = UUID.fromString(accountId.substring(separator + 1));
            return CounterpartyDirectory.resolve(directory, owner).displayName();
        } catch (IllegalArgumentException notAnIdentifier) {
            return accountId;
        }
    }

    private long sum(List<JournalEntryEntity> lines, EntryDirection direction) {
        return lines.stream()
                .filter(line -> line.getDirection() == direction)
                .mapToLong(JournalEntryEntity::getAmountMinor)
                .sum();
    }

    private Map<UUID, String> referencesFor(List<AuditEventEntity> events) {
        List<UUID> ids =
                events.stream()
                        .map(AuditEventEntity::getPaymentId)
                        .filter(java.util.Objects::nonNull)
                        .distinct()
                        .toList();
        Map<UUID, String> references = new HashMap<>();
        for (PaymentEntity payment : payments.findAllById(ids)) {
            references.put(payment.getId(), payment.getReference());
        }
        return references;
    }

    private AuditEventView auditView(AuditEventEntity event, String paymentReference) {
        return new AuditEventView(
                event.getId(),
                event.getPaymentId(),
                paymentReference,
                event.getEventType(),
                ConsoleVocabulary.auditLabel(event.getEventType()),
                event.getActor(),
                event.getDetail(),
                ConsoleVocabulary.auditTone(event.getEventType()),
                event.getCreatedAt());
    }

    private List<PaymentRow> exceptionPreview() {
        return rows(
                payments.findByStatusOrderByCreatedAtDesc(
                        PaymentStatus.PENDING, PageRequest.of(0, EXCEPTION_PREVIEW_LIMIT)));
    }

    private LedgerHealth ledgerHealth() {
        List<Object[]> volumes = journalEntries.postedVolumeByCurrency(EntryDirection.DEBIT);
        String currency = volumes.isEmpty() ? "USD" : (String) volumes.get(0)[0];
        long posted = volumes.isEmpty() ? 0 : ((Number) volumes.get(0)[1]).longValue();
        return new LedgerHealth(
                journals.count(),
                journals.countBalanced(EntryDirection.DEBIT),
                posted,
                currency,
                journals.lastPostedAt());
    }

    private List<ThroughputBucket> throughput(
            ConsoleRange range, List<PaymentPulse> pulses, Instant now) {
        DateTimeFormatter formatter =
                DateTimeFormatter.ofPattern(range.bucketPattern(), Locale.ENGLISH)
                        .withZone(ZoneOffset.UTC);
        Map<Instant, long[]> counts = new LinkedHashMap<>();
        for (Instant boundary : range.buckets(now)) {
            counts.put(boundary, new long[5]);
        }
        for (PaymentPulse pulse : pulses) {
            Instant bucket = range.truncate(pulse.createdAt());
            long[] slot = counts.get(bucket);
            if (slot == null) {
                continue;
            }
            switch (pulse.status()) {
                case APPROVED -> slot[0]++;
                case REVIEW -> slot[1]++;
                case REJECTED -> slot[2]++;
                case PENDING -> slot[3]++;
            }
            slot[4] += pulse.amountMinor();
        }
        return counts.entrySet().stream()
                .map(
                        entry ->
                                new ThroughputBucket(
                                        entry.getKey(),
                                        formatter.format(entry.getKey()),
                                        entry.getValue()[0],
                                        entry.getValue()[1],
                                        entry.getValue()[2],
                                        entry.getValue()[3],
                                        entry.getValue()[4]))
                .toList();
    }

    private List<DecisionSlice> decisionMix(List<PaymentPulse> pulses) {
        Map<PaymentStatus, Long> counts = new EnumMap<>(PaymentStatus.class);
        for (PaymentStatus status : PaymentStatus.values()) {
            counts.put(status, 0L);
        }
        pulses.forEach(pulse -> counts.merge(pulse.status(), 1L, Long::sum));
        long total = pulses.size();
        return List.of(PaymentStatus.APPROVED, PaymentStatus.REVIEW, PaymentStatus.REJECTED, PaymentStatus.PENDING)
                .stream()
                .map(
                        status ->
                                new DecisionSlice(
                                        status.name(),
                                        label(status),
                                        counts.get(status),
                                        total == 0 ? 0 : (counts.get(status) * 100.0) / total))
                .toList();
    }

    private static String label(PaymentStatus status) {
        return switch (status) {
            case APPROVED -> "Approved";
            case REVIEW -> "Review";
            case REJECTED -> "Rejected";
            case PENDING -> "Pending";
        };
    }

    private List<SignalActivity> signalActivity(
            List<PaymentPulse> current, List<PaymentPulse> prior) {
        Map<String, Long> now = countSignals(current);
        Map<String, Long> before = countSignals(prior);
        long total = now.values().stream().mapToLong(Long::longValue).sum();
        return ConsoleVocabulary.RISK_SIGNAL_CODES.stream()
                .map(
                        code ->
                                new SignalActivity(
                                        code,
                                        ConsoleVocabulary.riskSignalLabel(code),
                                        now.getOrDefault(code, 0L),
                                        before.getOrDefault(code, 0L),
                                        total == 0
                                                ? 0
                                                : (now.getOrDefault(code, 0L) * 100.0) / total))
                .sorted(Comparator.comparingLong(SignalActivity::count).reversed())
                .toList();
    }

    private Map<String, Long> countSignals(List<PaymentPulse> pulses) {
        Map<String, Long> counts = new HashMap<>();
        for (PaymentPulse pulse : pulses) {
            for (String code : pulse.signalCodes()) {
                counts.merge(code, 1L, Long::sum);
            }
        }
        return counts;
    }

    private Metric volumeMetric(List<PaymentPulse> current, List<PaymentPulse> prior) {
        long now = current.stream().mapToLong(PaymentPulse::amountMinor).sum();
        long before = prior.stream().mapToLong(PaymentPulse::amountMinor).sum();
        return new Metric(
                "processedVolume",
                "Processed volume",
                "currency",
                now,
                before,
                delta(now, before),
                true,
                current.size() + (current.size() == 1 ? " payment" : " payments"));
    }

    private Metric approvalMetric(List<PaymentPulse> current, List<PaymentPulse> prior) {
        double now = approvalRate(current);
        double before = approvalRate(prior);
        long approved =
                current.stream().filter(pulse -> pulse.status() == PaymentStatus.APPROVED).count();
        return new Metric(
                "approvalRate",
                "Approval rate",
                "percent",
                now,
                before,
                delta(now, before),
                true,
                approved + " of " + current.size() + " approved");
    }

    private Metric reviewMetric(List<PaymentPulse> current, List<PaymentPulse> prior) {
        long now = current.stream().filter(pulse -> pulse.status() == PaymentStatus.REVIEW).count();
        long before = prior.stream().filter(pulse -> pulse.status() == PaymentStatus.REVIEW).count();
        return new Metric(
                "manualReview",
                "Manual review",
                "count",
                now,
                before,
                delta(now, before),
                false,
                now == 0 ? "No analyst queue" : "Waiting on an analyst");
    }

    private double approvalRate(List<PaymentPulse> pulses) {
        if (pulses.isEmpty()) {
            return 0;
        }
        long approved =
                pulses.stream().filter(pulse -> pulse.status() == PaymentStatus.APPROVED).count();
        return (approved * 100.0) / pulses.size();
    }

    /** Null when the prior window was empty: a rise from nothing is not a percentage. */
    private Double delta(double now, double before) {
        if (before == 0) {
            return null;
        }
        return ((now - before) / before) * 100.0;
    }

    private String severity(long ageSeconds, boolean journalPosted, JournalVerification verification) {
        if (journalPosted && (!verification.balanced() || !verification.matchesPayment())) {
            return "Critical";
        }
        if (ageSeconds >= CRITICAL_AGE.getSeconds()) {
            return "High";
        }
        if (ageSeconds >= HIGH_AGE.getSeconds()) {
            return "Medium";
        }
        return "Low";
    }

    private int severityRank(String severity) {
        return switch (severity) {
            case "Critical" -> 0;
            case "High" -> 1;
            case "Medium" -> 2;
            default -> 3;
        };
    }

    private String reason(boolean journalPosted, JournalVerification verification) {
        if (!journalPosted) {
            return "Status is pending and no journal was posted; no money moved.";
        }
        if (!verification.balanced()) {
            return "A journal exists but its debits and credits do not cancel.";
        }
        if (!verification.matchesPayment()) {
            return "A balanced journal exists but it does not match this payment.";
        }
        return "Ledger posted, final status never observed.";
    }

    private String strategy(ReconciliationAction action) {
        return switch (action) {
            case FINALIZE_APPROVED ->
                    "Verify the committed journal, then compare-and-swap the pending row to APPROVED.";
            case FINALIZE_DECISION ->
                    "No journal to protect; apply the recorded risk decision under the version guard.";
            case FLAG_MANUAL_REVIEW ->
                    "Evidence is inconsistent; route to an analyst instead of writing money.";
            case NO_OP -> "Already final; nothing to do.";
        };
    }

    private int clampSize(int size) {
        return Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
    }
}
