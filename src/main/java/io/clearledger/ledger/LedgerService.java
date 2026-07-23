package io.clearledger.ledger;

import io.clearledger.payment.PaymentEntity;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;

@Service
public class LedgerService {
    private final JournalRepository journals;
    private final JournalEntryRepository entries;
    private final Clock clock;

    public LedgerService(
            JournalRepository journals, JournalEntryRepository entries, Clock clock) {
        this.journals = journals;
        this.entries = entries;
        this.clock = clock;
    }

    public JournalSnapshot post(PaymentEntity payment) {
        return journals.findByPaymentId(payment.getId())
                .map(this::snapshot)
                .orElseGet(() -> postNew(payment));
    }

    public Optional<JournalSnapshot> findByPaymentId(UUID paymentId) {
        return journals.findByPaymentId(paymentId).map(this::snapshot);
    }

    private JournalSnapshot postNew(PaymentEntity payment) {
        Instant now = clock.instant();
        JournalEntity journal =
                journals.save(new JournalEntity(UUID.randomUUID(), payment.getId(), now));
        List<JournalEntryEntity> lines =
                List.of(
                        new JournalEntryEntity(
                                UUID.randomUUID(),
                                journal.getId(),
                                "CUSTOMER:" + payment.getSenderId(),
                                EntryDirection.DEBIT,
                                payment.getAmountMinor(),
                                payment.getCurrency(),
                                now),
                        new JournalEntryEntity(
                                UUID.randomUUID(),
                                journal.getId(),
                                "CUSTOMER:" + payment.getRecipientId(),
                                EntryDirection.CREDIT,
                                payment.getAmountMinor(),
                                payment.getCurrency(),
                                now));
        entries.saveAll(lines);
        return snapshot(journal);
    }

    private JournalSnapshot snapshot(JournalEntity journal) {
        List<JournalLineSnapshot> lines =
                entries.findByJournalIdOrderByDirectionAsc(journal.getId()).stream()
                        .map(
                                entry ->
                                        new JournalLineSnapshot(
                                                entry.getAccountId(),
                                                entry.getDirection(),
                                                entry.getAmountMinor(),
                                                entry.getCurrency()))
                        .toList();
        return new JournalSnapshot(journal.getId(), journal.getPaymentId(), lines);
    }
}
