package io.clearledger.ledger;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface JournalEntryRepository extends JpaRepository<JournalEntryEntity, UUID> {
    List<JournalEntryEntity> findByJournalIdOrderByDirectionAsc(UUID journalId);
}
