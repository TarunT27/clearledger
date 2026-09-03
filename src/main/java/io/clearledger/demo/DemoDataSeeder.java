package io.clearledger.demo;

import io.clearledger.audit.AuditEventEntity;
import io.clearledger.audit.AuditEventRepository;
import io.clearledger.counterparty.CounterpartyEntity;
import io.clearledger.counterparty.CounterpartyRepository;
import io.clearledger.counterparty.CounterpartyRole;
import io.clearledger.ledger.EntryDirection;
import io.clearledger.ledger.JournalEntity;
import io.clearledger.ledger.JournalEntryEntity;
import io.clearledger.ledger.JournalEntryRepository;
import io.clearledger.ledger.JournalRepository;
import io.clearledger.payment.CreatePaymentRequest;
import io.clearledger.payment.EstablishedRecipientRepository;
import io.clearledger.payment.IdempotencyKeyHasher;
import io.clearledger.payment.PaymentEntity;
import io.clearledger.payment.PaymentRepository;
import io.clearledger.payment.PaymentRequestData;
import io.clearledger.payment.PaymentStatus;
import io.clearledger.payment.RequestFingerprint;
import io.clearledger.risk.RiskAssessment;
import io.clearledger.risk.RiskContext;
import io.clearledger.risk.RiskDecision;
import io.clearledger.risk.RiskEngine;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Random;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Fills an empty demo database with a month of plausible payment history.
 *
 * <p>The rows are written through the same domain objects the live path uses — the same
 * {@link RiskEngine}, the same {@link PaymentEntity#pending} factory, the same balanced
 * two-line journals and the same audit vocabulary — with the clock moved backwards for
 * each record. That matters: it means the console's charts, risk counts and ledger totals
 * are computed from data the engine itself would have produced, not from numbers invented
 * to look good. Nothing here bypasses an invariant.
 *
 * <p>It runs only on the {@code demo} profile and only when the payments table is empty.
 */
@Component
@ConditionalOnProperty(name = "clearledger.demo.seed-history", havingValue = "true")
public class DemoDataSeeder implements ApplicationRunner {
    private static final Logger log = LoggerFactory.getLogger(DemoDataSeeder.class);

    private static final long SEED = 20_260_903L;
    /** Two months, so the 30-day view has a full prior window to compare against. */
    private static final int HISTORY_DAYS = 62;
    private static final Duration ATTEMPT_WINDOW = Duration.ofMinutes(10);
    private static final Duration VELOCITY_WINDOW = Duration.ofHours(1);

    private static final String[] MEMOS = {
        "Invoice %d — materials",
        "Invoice %d — monthly retainer",
        "Invoice %d — freight and duties",
        "Invoice %d — software subscription",
        "Invoice %d — facilities maintenance",
        "Invoice %d — contract milestone",
        "Invoice %d — logistics settlement",
        "Invoice %d — professional services",
        "Invoice %d — benefits remittance",
        "Invoice %d — colocation and power",
    };

    private final PaymentRepository payments;
    private final JournalRepository journals;
    private final JournalEntryRepository journalEntries;
    private final AuditEventRepository auditEvents;
    private final CounterpartyRepository counterparties;
    private final EstablishedRecipientRepository establishedRecipients;
    private final RiskEngine riskEngine;
    private final Clock clock;

    public DemoDataSeeder(
            PaymentRepository payments,
            JournalRepository journals,
            JournalEntryRepository journalEntries,
            AuditEventRepository auditEvents,
            CounterpartyRepository counterparties,
            EstablishedRecipientRepository establishedRecipients,
            RiskEngine riskEngine,
            Clock clock) {
        this.payments = payments;
        this.journals = journals;
        this.journalEntries = journalEntries;
        this.auditEvents = auditEvents;
        this.counterparties = counterparties;
        this.establishedRecipients = establishedRecipients;
        this.riskEngine = riskEngine;
        this.clock = clock;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (payments.count() > 0) {
            log.info("Demo history already present; skipping seed.");
            return;
        }
        List<CounterpartyEntity> senders =
                counterparties.findByRoleOrderByDisplayNameAsc(CounterpartyRole.SENDER);
        List<CounterpartyEntity> recipients =
                counterparties.findByRoleOrderByDisplayNameAsc(CounterpartyRole.RECIPIENT);
        if (senders.isEmpty() || recipients.isEmpty()) {
            log.warn("No counterparties found; skipping demo seed.");
            return;
        }

        Random random = new Random(SEED);
        Instant now = clock.instant();
        Instant start =
                now.minus(Duration.ofDays(HISTORY_DAYS - 1L)).truncatedTo(ChronoUnit.DAYS);
        int created = 0;
        int invoice = 4100;

        for (int day = 0; day < HISTORY_DAYS; day++) {
            Instant midnight = start.plus(Duration.ofDays(day));
            boolean weekend = isWeekend(midnight);
            int volume = weekend ? 2 + random.nextInt(3) : 7 + random.nextInt(7);
            // Roughly one day in six carries a settlement burst: several payments from the
            // same account inside one hour. Nothing forces a decision here — the engine's
            // own repeated-attempt and velocity rules react to the timing.
            boolean burstDay = !weekend && random.nextInt(6) == 0;
            CounterpartyEntity burstSender = senders.get(random.nextInt(senders.size()));
            Duration burstHour = Duration.ofHours(9 + random.nextInt(6));

            for (int index = 0; index < volume; index++) {
                boolean inBurst = burstDay && index < 4;
                Instant at =
                        inBurst
                                ? midnight.plus(burstHour)
                                        .plus(Duration.ofMinutes(index * 9L + random.nextInt(6)))
                                : midnight.plus(businessOffset(random));
                if (!at.isBefore(now)) {
                    continue;
                }
                CounterpartyEntity sender =
                        inBurst ? burstSender : senders.get(random.nextInt(senders.size()));
                CounterpartyEntity recipient = recipients.get(random.nextInt(recipients.size()));
                if (recipient.getId().equals(sender.getId())) {
                    continue;
                }
                CreatePaymentRequest request =
                        new CreatePaymentRequest(
                                sender.getId(),
                                recipient.getId(),
                                amount(random),
                                currency(random),
                                String.format(MEMOS[random.nextInt(MEMOS.length)], invoice++));
                write(request, at, false);
                created++;
            }
        }

        // Three payments that timed out after their journal committed and are still waiting
        // for reconciliation. These are the exceptions an operator repairs from the console.
        for (int index = 0; index < 3; index++) {
            CounterpartyEntity sender = senders.get(index % senders.size());
            CounterpartyEntity recipient = recipients.get((index * 3 + 1) % recipients.size());
            Instant at = now.minus(Duration.ofMinutes(7L + index * 53L));
            write(
                    new CreatePaymentRequest(
                            sender.getId(),
                            recipient.getId(),
                            120_000L + index * 47_500L,
                            "USD",
                            String.format(MEMOS[index % MEMOS.length], invoice++)),
                    at,
                    true);
            created++;
        }

        log.info("Seeded demo history payments={} days={}", created, HISTORY_DAYS);
    }

    /**
     * Writes one payment exactly the way the live path would have written it at {@code at}:
     * assess risk from the state that existed then, persist, post a balanced journal when
     * approved, and finalize — unless this record is meant to model a timeout, in which
     * case the journal commits and the status is deliberately left pending.
     */
    private void write(CreatePaymentRequest request, Instant at, boolean timeout) {
        Clock frozen = Clock.fixed(at, ZoneOffset.UTC);
        RiskAssessment assessment = riskEngine.assess(contextAt(request, at));
        UUID paymentId = UUID.randomUUID();
        PaymentEntity payment =
                payments.save(
                        PaymentEntity.pending(
                                paymentId,
                                request,
                                IdempotencyKeyHasher.sha256("seed-" + paymentId),
                                RequestFingerprint.sha256(
                                        new PaymentRequestData(
                                                request.senderId(),
                                                request.recipientId(),
                                                request.amountMinor(),
                                                request.currency(),
                                                request.description())),
                                assessment,
                                frozen));
        audit(
                paymentId,
                "PAYMENT_ACCEPTED",
                "PAYMENT_API",
                "Risk decision=" + assessment.decision() + ", score=" + assessment.score(),
                at);

        boolean posts = assessment.decision() == RiskDecision.APPROVED;
        if (posts) {
            postJournal(payment, at);
            audit(
                    paymentId,
                    "JOURNAL_POSTED",
                    "LEDGER",
                    "Balanced debit and credit entries committed.",
                    at);
        }

        if (timeout) {
            payment.markReconciliationRequired(frozen);
            audit(
                    paymentId,
                    "RECONCILIATION_REQUIRED",
                    "PAYMENT_PROCESSOR",
                    "Final status was not observed after the committed initiation.",
                    at);
            return;
        }

        PaymentStatus target = statusFor(assessment.decision());
        payment.finalizeAs(target, Clock.fixed(at.plusSeconds(1), ZoneOffset.UTC));
        audit(
                paymentId,
                "PAYMENT_FINALIZED",
                "PAYMENT_PROCESSOR",
                "Status changed to " + target + ".",
                at.plusSeconds(1));
    }

    private RiskContext contextAt(CreatePaymentRequest request, Instant at) {
        int attempts =
                Math.toIntExact(
                        payments.countBySenderIdAndCreatedAtAfter(
                                request.senderId(), at.minus(ATTEMPT_WINDOW)));
        boolean established =
                establishedRecipients.exists(request.senderId(), request.recipientId())
                        || payments.existsBySenderIdAndRecipientIdAndStatus(
                                request.senderId(),
                                request.recipientId(),
                                PaymentStatus.APPROVED);
        long velocity =
                payments.outgoingAmountSince(
                        request.senderId(), at.minus(VELOCITY_WINDOW), RiskDecision.APPROVED);
        return new RiskContext(request.amountMinor(), attempts, established, velocity);
    }

    private void postJournal(PaymentEntity payment, Instant at) {
        JournalEntity journal =
                journals.save(new JournalEntity(UUID.randomUUID(), payment.getId(), at));
        journalEntries.saveAll(
                List.of(
                        new JournalEntryEntity(
                                UUID.randomUUID(),
                                journal.getId(),
                                "CUSTOMER:" + payment.getSenderId(),
                                EntryDirection.DEBIT,
                                payment.getAmountMinor(),
                                payment.getCurrency(),
                                at),
                        new JournalEntryEntity(
                                UUID.randomUUID(),
                                journal.getId(),
                                "CUSTOMER:" + payment.getRecipientId(),
                                EntryDirection.CREDIT,
                                payment.getAmountMinor(),
                                payment.getCurrency(),
                                at)));
    }

    private void audit(UUID paymentId, String type, String actor, String detail, Instant at) {
        auditEvents.save(
                new AuditEventEntity(UUID.randomUUID(), paymentId, type, actor, detail, at));
    }

    private PaymentStatus statusFor(RiskDecision decision) {
        return switch (decision) {
            case APPROVED -> PaymentStatus.APPROVED;
            case REVIEW -> PaymentStatus.REVIEW;
            case REJECTED -> PaymentStatus.REJECTED;
        };
    }

    /** Payments cluster in the working day rather than spreading evenly over 24 hours. */
    private Duration businessOffset(Random random) {
        int hour = 7 + random.nextInt(11);
        return Duration.ofHours(hour)
                .plusMinutes(random.nextInt(60))
                .plusSeconds(random.nextInt(60));
    }

    private boolean isWeekend(Instant instant) {
        int day = instant.atZone(ZoneOffset.UTC).getDayOfWeek().getValue();
        return day >= 6;
    }

    /**
     * A long-tailed amount distribution: mostly ordinary invoices, a few large ones that
     * cross the unusual-amount threshold and let the risk rules actually fire.
     */
    private long amount(Random random) {
        double roll = random.nextDouble();
        if (roll < 0.74) {
            return 25_000L + random.nextInt(275_000);
        }
        if (roll < 0.95) {
            return 300_000L + random.nextInt(640_000);
        }
        return 1_000_000L + random.nextInt(1_100_000);
    }

    private String currency(Random random) {
        double roll = random.nextDouble();
        if (roll < 0.82) {
            return "USD";
        }
        return roll < 0.93 ? "EUR" : "GBP";
    }
}
