package io.clearledger.reconciliation;

import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface ReconciliationRunRepository
        extends JpaRepository<ReconciliationRunEntity, UUID> {

    List<ReconciliationRunEntity> findAllByOrderByStartedAtDesc(Pageable pageable);

    /**
     * Totals across every run ever recorded, not just the handful the board lists. Summing
     * the displayed page would have made the figure depend on the page size.
     */
    @Query(
            """
            select coalesce(sum(run.repaired), 0), coalesce(sum(run.flagged), 0)
              from ReconciliationRunEntity run
            """)
    List<Object[]> totals();
}
