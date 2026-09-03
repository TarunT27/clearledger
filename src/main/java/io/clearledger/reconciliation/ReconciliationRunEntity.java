package io.clearledger.reconciliation;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "reconciliation_runs")
public class ReconciliationRunEntity {

    @Id private UUID id;
    @Column(name = "started_at", nullable = false) private Instant startedAt;
    @Column(name = "completed_at", nullable = false) private Instant completedAt;
    @Column(nullable = false) private int scanned;
    @Column(nullable = false) private int repaired;
    @Column(nullable = false) private int flagged;

    @Enumerated(EnumType.STRING)
    @Column(name = "trigger_source", nullable = false, length = 16)
    private ReconciliationTrigger triggerSource;

    protected ReconciliationRunEntity() {}

    public ReconciliationRunEntity(
            UUID id,
            Instant startedAt,
            Instant completedAt,
            int scanned,
            int repaired,
            int flagged,
            ReconciliationTrigger triggerSource) {
        this.id = id;
        this.startedAt = startedAt;
        this.completedAt = completedAt;
        this.scanned = scanned;
        this.repaired = repaired;
        this.flagged = flagged;
        this.triggerSource = triggerSource;
    }

    public ReconciliationService.ReconciliationRun snapshot() {
        return new ReconciliationService.ReconciliationRun(
                id, startedAt, completedAt, scanned, repaired, flagged, triggerSource);
    }
}
