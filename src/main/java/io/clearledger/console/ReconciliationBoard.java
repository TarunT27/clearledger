package io.clearledger.console;

import io.clearledger.counterparty.CounterpartySnapshot;
import io.clearledger.reconciliation.ReconciliationAction;
import io.clearledger.reconciliation.ReconciliationService.ReconciliationRun;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** The reconciliation workbench: open cases, what the planner would do, and run history. */
public record ReconciliationBoard(
        List<Case> cases, List<ReconciliationRun> runs, Stats stats, Instant generatedAt) {

    public ReconciliationBoard {
        cases = List.copyOf(cases);
        runs = List.copyOf(runs);
    }

    /**
     * A pending payment together with the ledger evidence a repair would rely on. Nothing
     * here is stored as a "case" row: it is derived on read from the payment, its journal,
     * and its audit trail, so the board can never drift from the ledger.
     */
    public record Case(
            UUID paymentId,
            String reference,
            CounterpartySnapshot sender,
            CounterpartySnapshot recipient,
            long amountMinor,
            String currency,
            String severity,
            String reason,
            Instant detectedAt,
            long ageSeconds,
            boolean journalPosted,
            boolean balanced,
            boolean matchesPayment,
            long version,
            ReconciliationAction plannedAction,
            String repairStrategy,
            JournalView journal,
            List<AuditEventView> evidence) {

        public Case {
            evidence = List.copyOf(evidence);
        }
    }

    public record Stats(
            long openCases,
            long journalBackedCases,
            long casesWithoutJournal,
            long repairableNow,
            Instant lastRunAt,
            long repairedAllTime,
            long flaggedAllTime,
            boolean workerEnabled,
            long workerIntervalMs) {}
}
