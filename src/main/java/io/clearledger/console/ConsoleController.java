package io.clearledger.console;

import io.clearledger.api.ApiEnvelope;
import io.clearledger.counterparty.CounterpartyRole;
import io.clearledger.counterparty.CounterpartySnapshot;
import io.clearledger.payment.PaymentStatus;
import io.clearledger.reconciliation.ReconciliationService;
import io.clearledger.risk.RiskDecision;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Read model for the operations console.
 *
 * <p>These endpoints are deliberately separate from {@code /api/v1/payments}: that is the
 * transactional contract other systems integrate against and it must stay stable, while
 * this surface exists to answer a screen's questions and is free to change with the UI.
 */
@RestController
@RequestMapping("/api/v1/console")
public class ConsoleController {
    private final ConsoleService console;

    public ConsoleController(ConsoleService console) {
        this.console = console;
    }

    @GetMapping("/overview")
    public ApiEnvelope<OverviewReport> overview(
            @RequestParam(required = false, defaultValue = "24h") String range) {
        return ApiEnvelope.success(console.overview(range));
    }

    @GetMapping("/payments")
    public ApiEnvelope<ConsolePage<PaymentRow>> payments(
            @RequestParam(required = false) String query,
            @RequestParam(required = false) PaymentStatus status,
            @RequestParam(required = false) RiskDecision risk,
            @RequestParam(required = false) String signal,
            @RequestParam(required = false, defaultValue = "false") boolean exceptionsOnly,
            @RequestParam(required = false, defaultValue = "createdAt") String sort,
            @RequestParam(required = false, defaultValue = "DESC") Sort.Direction direction,
            @RequestParam(required = false, defaultValue = "0") int page,
            @RequestParam(required = false, defaultValue = "20") int size) {
        PaymentQuery request =
                new PaymentQuery(
                        query, status, risk, signal, null, exceptionsOnly, sort, direction);
        return ApiEnvelope.success(console.payments(request, page, size));
    }

    @GetMapping("/payments/{paymentId}")
    public ApiEnvelope<PaymentDetail> payment(@PathVariable UUID paymentId) {
        return ApiEnvelope.success(console.payment(paymentId));
    }

    @GetMapping("/journals")
    public ApiEnvelope<ConsolePage<JournalView>> journals(
            @RequestParam(required = false) String query,
            @RequestParam(required = false, defaultValue = "0") int page,
            @RequestParam(required = false, defaultValue = "20") int size) {
        return ApiEnvelope.success(console.journals(query, page, size));
    }

    @GetMapping("/audit-events")
    public ApiEnvelope<ConsolePage<AuditEventView>> auditEvents(
            @RequestParam(required = false) String query,
            @RequestParam(required = false) String eventType,
            @RequestParam(required = false, defaultValue = "0") int page,
            @RequestParam(required = false, defaultValue = "25") int size) {
        return ApiEnvelope.success(
                console.auditEvents(query, eventType, page, size),
                Map.of("eventTypes", console.auditEventTypes()));
    }

    @GetMapping("/risk")
    public ApiEnvelope<RiskReport> risk(
            @RequestParam(required = false, defaultValue = "24h") String range) {
        return ApiEnvelope.success(console.risk(range));
    }

    @GetMapping("/reconciliation")
    public ApiEnvelope<ReconciliationBoard> reconciliation() {
        return ApiEnvelope.success(console.reconciliationBoard());
    }

    /**
     * Repairs one case. This is the only console endpoint that writes, and it delegates
     * straight to the reconciliation service so an operator-triggered repair obeys exactly
     * the same compare-and-swap rules as the background worker.
     */
    @PostMapping("/reconciliation/cases/{paymentId}/repair")
    public ApiEnvelope<ReconciliationService.RepairOutcome> repair(@PathVariable UUID paymentId) {
        return ApiEnvelope.success(console.repair(paymentId));
    }

    @GetMapping("/counterparties")
    public ApiEnvelope<List<CounterpartySnapshot>> counterparties(
            @RequestParam(required = false, defaultValue = "RECIPIENT") CounterpartyRole role) {
        return ApiEnvelope.success(console.counterparties(role));
    }
}
