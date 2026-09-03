package io.clearledger.ledger;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface JournalRepository extends JpaRepository<JournalEntity, UUID> {

    Optional<JournalEntity> findByPaymentId(UUID paymentId);

    List<JournalEntity> findByPaymentIdIn(Collection<UUID> paymentIds);

    Page<JournalEntity> findAllByOrderByCreatedAtDesc(Pageable pageable);

    /**
     * Journals whose payment matches the operator's search text.
     *
     * <p>The search runs here rather than over an already-fetched page, so the footer's row
     * count is the real number of matches and page two of a search is still the same search.
     * A journal carries no searchable text of its own — it is an identifier, two amounts and
     * a payment — so the match is made against that payment.
     *
     * @param parties counterparty ids whose name matched, resolved before the query;
     *     callers pass a sentinel rather than an empty collection because an empty
     *     {@code in ()} is not valid
     */
    @Query(
            value =
                    """
                    select journal
                      from JournalEntity journal, io.clearledger.payment.PaymentEntity payment
                     where journal.paymentId = payment.id
                       and (lower(payment.reference) like :text
                            or lower(payment.description) like :text
                            or lower(payment.currency) like :text
                            or payment.senderId in :parties
                            or payment.recipientId in :parties)
                     order by journal.createdAt desc
                    """,
            countQuery =
                    """
                    select count(journal)
                      from JournalEntity journal, io.clearledger.payment.PaymentEntity payment
                     where journal.paymentId = payment.id
                       and (lower(payment.reference) like :text
                            or lower(payment.description) like :text
                            or lower(payment.currency) like :text
                            or payment.senderId in :parties
                            or payment.recipientId in :parties)
                    """)
    Page<JournalEntity> search(
            @Param("text") String text,
            @Param("parties") Collection<UUID> parties,
            Pageable pageable);

    @Query("select max(journal.createdAt) from JournalEntity journal")
    Instant lastPostedAt();

    @Query(
            """
            select count(journal) from JournalEntity journal
             where journal.createdAt >= :since
            """)
    long countSince(@Param("since") Instant since);

    /**
     * Journals whose debits and credits cancel exactly. The check runs in SQL rather than
     * in Java so the reported figure is the database's own answer, not a cached one.
     */
    @Query(
            """
            select count(journal) from JournalEntity journal
             where 0 = (select coalesce(sum(case when entry.direction = :debit
                                                 then entry.amountMinor
                                                 else -entry.amountMinor end), 0)
                          from JournalEntryEntity entry
                         where entry.journalId = journal.id)
            """)
    long countBalanced(@Param("debit") EntryDirection debit);
}
