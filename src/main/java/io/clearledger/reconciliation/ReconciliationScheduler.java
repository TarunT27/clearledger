package io.clearledger.reconciliation;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(
        name = "clearledger.reconciliation.enabled",
        havingValue = "true",
        matchIfMissing = true)
public class ReconciliationScheduler {
    private final ReconciliationService reconciliation;

    public ReconciliationScheduler(ReconciliationService reconciliation) {
        this.reconciliation = reconciliation;
    }

    @Scheduled(fixedDelayString = "${clearledger.reconciliation.fixed-delay-ms:30000}")
    public void run() {
        reconciliation.reconcile();
    }
}
