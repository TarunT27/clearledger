package io.clearledger.ledger;

import io.clearledger.payment.PaymentSnapshot;
import java.util.List;

public final class JournalVerifier {

    public JournalVerification verify(PaymentSnapshot payment, JournalSnapshot journal) {
        long debits = total(journal.lines(), EntryDirection.DEBIT);
        long credits = total(journal.lines(), EntryDirection.CREDIT);
        boolean balanced = debits > 0 && debits == credits;
        boolean matchingLines =
                journal.lines().size() == 2
                        && contains(
                                journal.lines(),
                                "CUSTOMER:" + payment.senderId(),
                                EntryDirection.DEBIT,
                                payment)
                        && contains(
                                journal.lines(),
                                "CUSTOMER:" + payment.recipientId(),
                                EntryDirection.CREDIT,
                                payment);
        return new JournalVerification(
                balanced,
                journal.paymentId().equals(payment.id())
                        && matchingLines
                        && debits == payment.amountMinor());
    }

    private long total(List<JournalLineSnapshot> lines, EntryDirection direction) {
        return lines.stream()
                .filter(line -> line.direction() == direction)
                .mapToLong(JournalLineSnapshot::amountMinor)
                .sum();
    }

    private boolean contains(
            List<JournalLineSnapshot> lines,
            String account,
            EntryDirection direction,
            PaymentSnapshot payment) {
        return lines.stream()
                .anyMatch(
                        line ->
                                line.accountId().equals(account)
                                        && line.direction() == direction
                                        && line.amountMinor() == payment.amountMinor()
                                        && line.currency().equals(payment.currency()));
    }
}
