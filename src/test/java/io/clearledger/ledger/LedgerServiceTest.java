package io.clearledger.ledger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.clearledger.payment.CreatePaymentRequest;
import io.clearledger.payment.PaymentEntity;
import io.clearledger.risk.RiskAssessment;
import io.clearledger.risk.RiskDecision;
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
class LedgerServiceTest {
    private static final Clock CLOCK =
            Clock.fixed(Instant.parse("2026-07-23T12:00:00Z"), ZoneOffset.UTC);
    @Mock JournalRepository journals;
    @Mock JournalEntryRepository entries;
    private LedgerService ledger;

    @BeforeEach
    void setUp() {
        ledger = new LedgerService(journals, entries, CLOCK);
    }

    @Test
    void postsExactlyOneDebitAndOneCredit() {
        PaymentEntity payment = payment();
        when(journals.findByPaymentId(payment.getId())).thenReturn(Optional.empty());
        when(journals.save(any(JournalEntity.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        when(entries.findByJournalIdOrderByDirectionAsc(any()))
                .thenReturn(List.of());

        JournalSnapshot result = ledger.post(payment);

        assertThat(result.paymentId()).isEqualTo(payment.getId());
        verify(entries).saveAll(anyList());
    }

    @Test
    void returnsExistingJournalWithoutPostingAgain() {
        PaymentEntity payment = payment();
        JournalEntity existing =
                new JournalEntity(UUID.randomUUID(), payment.getId(), CLOCK.instant());
        when(journals.findByPaymentId(payment.getId()))
                .thenReturn(Optional.of(existing));
        when(entries.findByJournalIdOrderByDirectionAsc(existing.getId()))
                .thenReturn(
                        List.of(
                                new JournalEntryEntity(
                                        UUID.randomUUID(),
                                        existing.getId(),
                                        "CUSTOMER:" + payment.getSenderId(),
                                        EntryDirection.DEBIT,
                                        payment.getAmountMinor(),
                                        payment.getCurrency(),
                                        CLOCK.instant())));

        JournalSnapshot result = ledger.post(payment);

        assertThat(result.lines()).hasSize(1);
        verify(entries, never()).saveAll(anyList());
    }

    @Test
    void findsJournalByPaymentId() {
        PaymentEntity payment = payment();
        JournalEntity existing =
                new JournalEntity(UUID.randomUUID(), payment.getId(), CLOCK.instant());
        when(journals.findByPaymentId(payment.getId()))
                .thenReturn(Optional.of(existing));
        when(entries.findByJournalIdOrderByDirectionAsc(existing.getId()))
                .thenReturn(List.of());

        assertThat(ledger.findByPaymentId(payment.getId())).isPresent();
    }

    private PaymentEntity payment() {
        return PaymentEntity.pending(
                UUID.randomUUID(),
                new CreatePaymentRequest(
                        UUID.randomUUID(),
                        UUID.randomUUID(),
                        2_500,
                        "USD",
                        "Ledger test"),
                "a".repeat(64),
                "b".repeat(64),
                new RiskAssessment(RiskDecision.APPROVED, 0, List.of()),
                CLOCK);
    }
}
