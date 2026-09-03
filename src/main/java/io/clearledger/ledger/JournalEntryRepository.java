package io.clearledger.ledger;

import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface JournalEntryRepository extends JpaRepository<JournalEntryEntity, UUID> {

    List<JournalEntryEntity> findByJournalIdOrderByDirectionAsc(UUID journalId);

    List<JournalEntryEntity> findByJournalIdInOrderByDirectionAsc(Collection<UUID> journalIds);

    /**
     * Total posted value per currency, taken from the debit side so each journal is counted
     * once. Reported as a list because a balanced journal is single-currency but the ledger
     * as a whole is not.
     */
    @Query(
            """
            select entry.currency, coalesce(sum(entry.amountMinor), 0)
              from JournalEntryEntity entry
             where entry.direction = :debit
             group by entry.currency
             order by sum(entry.amountMinor) desc
            """)
    List<Object[]> postedVolumeByCurrency(@Param("debit") EntryDirection debit);
}
