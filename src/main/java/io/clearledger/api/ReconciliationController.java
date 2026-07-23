package io.clearledger.api;

import io.clearledger.reconciliation.ReconciliationService;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/reconciliation")
public class ReconciliationController {
    private final ReconciliationService reconciliation;

    public ReconciliationController(ReconciliationService reconciliation) {
        this.reconciliation = reconciliation;
    }

    @PostMapping("/runs")
    public ApiEnvelope<ReconciliationService.ReconciliationRun> run(
            @RequestHeader("X-ClearLedger-Request") String requestMarker) {
        return ApiEnvelope.success(reconciliation.reconcile());
    }
}
