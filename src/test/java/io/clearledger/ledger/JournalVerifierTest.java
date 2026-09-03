package io.clearledger.ledger;

import static org.assertj.core.api.Assertions.assertThat;

import io.clearledger.payment.PaymentReference;
import io.clearledger.payment.PaymentSnapshot;
import io.clearledger.payment.PaymentStatus;
import io.clearledger.risk.RiskDecision;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class JournalVerifierTest {

    @Test
    void acceptsOnlyMatchingBalancedDoubleEntryJournal() {
        UUID paymentId = UUID.randomUUID();
        UUID sender = UUID.randomUUID();
        UUID recipient = UUID.randomUUID();
        PaymentSnapshot payment =
                new PaymentSnapshot(
                        paymentId, PaymentReference.of(paymentId), sender, recipient, 12_500, "USD", "Invoice",
                        PaymentStatus.PENDING, RiskDecision.APPROVED, 0, List.of(),
                        Instant.now(), Instant.now());
        JournalSnapshot journal =
                new JournalSnapshot(
                        UUID.randomUUID(),
                        paymentId,
                        List.of(
                                new JournalLineSnapshot("CUSTOMER:" + sender, EntryDirection.DEBIT, 12_500, "USD"),
                                new JournalLineSnapshot("CUSTOMER:" + recipient, EntryDirection.CREDIT, 12_500, "USD")));

        JournalVerification result = new JournalVerifier().verify(payment, journal);

        assertThat(result.balanced()).isTrue();
        assertThat(result.matchesPayment()).isTrue();
    }

    @Test
    void rejectsJournalWithDifferentAmountEvenWhenBalanced() {
        UUID paymentId = UUID.randomUUID();
        UUID sender = UUID.randomUUID();
        UUID recipient = UUID.randomUUID();
        PaymentSnapshot payment =
                new PaymentSnapshot(
                        paymentId, PaymentReference.of(paymentId), sender, recipient, 12_500, "USD", "Invoice",
                        PaymentStatus.PENDING, RiskDecision.APPROVED, 0, List.of(),
                        Instant.now(), Instant.now());
        JournalSnapshot journal =
                new JournalSnapshot(
                        UUID.randomUUID(),
                        paymentId,
                        List.of(
                                new JournalLineSnapshot("CUSTOMER:" + sender, EntryDirection.DEBIT, 1, "USD"),
                                new JournalLineSnapshot("CUSTOMER:" + recipient, EntryDirection.CREDIT, 1, "USD")));

        JournalVerification result = new JournalVerifier().verify(payment, journal);

        assertThat(result.balanced()).isTrue();
        assertThat(result.matchesPayment()).isFalse();
    }
}
