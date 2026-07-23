package io.clearledger.ledger;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface JournalRepository extends JpaRepository<JournalEntity, UUID> {
    Optional<JournalEntity> findByPaymentId(UUID paymentId);
}
