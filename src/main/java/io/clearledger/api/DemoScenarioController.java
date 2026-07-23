package io.clearledger.api;

import io.clearledger.payment.CreatePaymentRequest;
import io.clearledger.payment.EstablishedRecipientRepository;
import io.clearledger.payment.PaymentCreationResult;
import io.clearledger.payment.PaymentService;
import io.clearledger.payment.PaymentSnapshot;
import io.clearledger.payment.ProcessingFault;
import io.clearledger.payment.SimulatedTimeoutException;
import io.clearledger.reconciliation.ReconciliationService;
import java.util.List;
import java.util.UUID;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/demo/scenarios")
@ConditionalOnProperty(name = "clearledger.demo.enabled", havingValue = "true")
public class DemoScenarioController {
    private final PaymentService payments;
    private final EstablishedRecipientRepository recipients;
    private final ReconciliationService reconciliation;

    public DemoScenarioController(
            PaymentService payments,
            EstablishedRecipientRepository recipients,
            ReconciliationService reconciliation) {
        this.payments = payments;
        this.recipients = recipients;
        this.reconciliation = reconciliation;
    }

    @PostMapping("/{scenario}")
    public ApiEnvelope<DemoScenarioResult> run(@PathVariable String scenario) {
        return ApiEnvelope.success(
                switch (scenario) {
                    case "normal" -> normal();
                    case "duplicate" -> duplicate();
                    case "timeout" -> timeout();
                    default -> throw new UnknownScenarioException(scenario);
                });
    }

    private DemoScenarioResult normal() {
        Fixture fixture = fixture();
        PaymentCreationResult result =
                payments.create(fixture.request(), fixture.key(), ProcessingFault.NONE);
        return new DemoScenarioResult(
                "normal",
                "Payment passed risk checks and its balanced journal was finalized.",
                result.payment(),
                result.payment(),
                false,
                null,
                List.of(
                        "request accepted",
                        "risk approved",
                        "journal committed",
                        "status approved"));
    }

    private DemoScenarioResult duplicate() {
        Fixture fixture = fixture();
        PaymentCreationResult first =
                payments.create(fixture.request(), fixture.key(), ProcessingFault.NONE);
        PaymentCreationResult second =
                payments.create(fixture.request(), fixture.key(), ProcessingFault.NONE);
        return new DemoScenarioResult(
                "duplicate",
                "The replay returned the original payment; no second journal was created.",
                first.payment(),
                second.payment(),
                second.duplicate(),
                null,
                List.of(
                        "first request processed",
                        "same key replayed",
                        "fingerprint matched",
                        "original result returned"));
    }

    private DemoScenarioResult timeout() {
        Fixture fixture = fixture();
        UUID paymentId;
        try {
            payments.create(
                    fixture.request(), fixture.key(), ProcessingFault.AFTER_LEDGER_COMMIT);
            throw new IllegalStateException("Timeout fault was not triggered.");
        } catch (SimulatedTimeoutException exception) {
            paymentId = exception.paymentId();
        }
        PaymentSnapshot before = payments.get(paymentId);
        return new DemoScenarioResult(
                "timeout",
                "A timeout left status pending after ledger commit; reconciliation is now required.",
                before,
                before,
                false,
                null,
                List.of(
                        "journal committed",
                        "timeout injected",
                        "pending inconsistency detected",
                        "reconciliation required",
                        "safe repair available"));
    }

    private Fixture fixture() {
        UUID sender = UUID.randomUUID();
        UUID recipient = UUID.randomUUID();
        recipients.establishForDemo(sender, recipient);
        return new Fixture(
                new CreatePaymentRequest(
                        sender, recipient, 75_000, "USD", "Demo invoice"),
                "demo-" + UUID.randomUUID());
    }

    private record Fixture(CreatePaymentRequest request, String key) {}

    public record DemoScenarioResult(
            String scenario,
            String narrative,
            PaymentSnapshot before,
            PaymentSnapshot after,
            boolean duplicateDetected,
            ReconciliationService.ReconciliationRun reconciliation,
            List<String> timeline) {
        public DemoScenarioResult {
            timeline = List.copyOf(timeline);
        }
    }
}
