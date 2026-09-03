package io.clearledger.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

import io.clearledger.payment.CreatePaymentRequest;
import io.clearledger.payment.EstablishedRecipientRepository;
import io.clearledger.payment.PaymentCreationResult;
import io.clearledger.payment.PaymentService;
import io.clearledger.payment.PaymentReference;
import io.clearledger.payment.PaymentSnapshot;
import io.clearledger.payment.PaymentStatus;
import io.clearledger.payment.ProcessingFault;
import io.clearledger.payment.SimulatedTimeoutException;
import io.clearledger.reconciliation.ReconciliationService;
import io.clearledger.reconciliation.ReconciliationTrigger;
import io.clearledger.risk.RiskDecision;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class ApiControllersTest {
    @Mock PaymentService payments;
    @Mock EstablishedRecipientRepository recipients;
    @Mock ReconciliationService reconciliation;
    private PaymentSnapshot approved;

    @BeforeEach
    void setUp() {
        approved = snapshot(PaymentStatus.APPROVED);
    }

    @Test
    void paymentControllerUsesCreatedAndOkForNewAndDuplicateRequests() {
        CreatePaymentRequest request =
                new CreatePaymentRequest(
                        UUID.randomUUID(),
                        UUID.randomUUID(),
                        1_000,
                        "USD",
                        "API test");
        PaymentController controller = new PaymentController(payments);
        when(payments.create(request, "valid-key", ProcessingFault.NONE))
                .thenReturn(new PaymentCreationResult(approved, false))
                .thenReturn(new PaymentCreationResult(approved, true));

        var created = controller.create(request, "valid-key");
        var replay = controller.create(request, "valid-key");

        assertThat(created.getStatusCode().value()).isEqualTo(201);
        assertThat(created.getHeaders().getLocation().toString())
                .endsWith(approved.id().toString());
        assertThat(replay.getStatusCode().value()).isEqualTo(200);
    }

    @Test
    void paymentControllerGetsAndListsWithEnvelopeMetadata() {
        PaymentController controller = new PaymentController(payments);
        when(payments.get(approved.id())).thenReturn(approved);
        when(payments.list(PaymentStatus.APPROVED, 500))
                .thenReturn(List.of(approved));

        assertThat(controller.get(approved.id()).data()).isEqualTo(approved);
        var listed = controller.list(PaymentStatus.APPROVED, 500);
        assertThat(listed.data()).containsExactly(approved);
        assertThat(listed.meta()).isNotNull();
    }

    @Test
    void dashboardAndReconciliationControllersWrapServiceResults() {
        PaymentService.DashboardSummary summary =
                new PaymentService.DashboardSummary(1, 0, 1, 0, 0, 100, 1_000);
        ReconciliationService.ReconciliationRun run =
                new ReconciliationService.ReconciliationRun(
                        UUID.randomUUID(),
                        Instant.now(),
                        Instant.now(),
                        1,
                        1,
                        0,
                        ReconciliationTrigger.MANUAL);
        when(payments.dashboard()).thenReturn(summary);
        when(reconciliation.reconcile()).thenReturn(run);

        assertThat(new DashboardController(payments).summary().data()).isEqualTo(summary);
        assertThat(new ReconciliationController(reconciliation).run("ClearLedgerConsole").data())
                .isEqualTo(run);
    }

    @Test
    void demoNormalAndDuplicateScenariosExposeTimeline() {
        when(payments.create(any(), anyString(), any(ProcessingFault.class)))
                .thenReturn(new PaymentCreationResult(approved, false))
                .thenReturn(new PaymentCreationResult(approved, false))
                .thenReturn(new PaymentCreationResult(approved, true));
        DemoScenarioController controller =
                new DemoScenarioController(payments, recipients, reconciliation);

        var normal = controller.run("normal").data();
        var duplicate = controller.run("duplicate").data();

        assertThat(normal.scenario()).isEqualTo("normal");
        assertThat(normal.timeline()).contains("journal committed");
        assertThat(duplicate.duplicateDetected()).isTrue();
    }

    @Test
    void demoTimeoutLeavesPendingStateForAnExplicitReconciliationRun() {
        UUID id = approved.id();
        PaymentSnapshot pending = snapshot(id, PaymentStatus.PENDING);
        when(payments.create(any(), anyString(), any(ProcessingFault.class)))
                .thenThrow(new SimulatedTimeoutException(id));
        when(payments.get(id)).thenReturn(pending);
        DemoScenarioController controller =
                new DemoScenarioController(payments, recipients, reconciliation);

        var result = controller.run("timeout").data();

        assertThat(result.before().status()).isEqualTo(PaymentStatus.PENDING);
        assertThat(result.after().status()).isEqualTo(PaymentStatus.PENDING);
        assertThat(result.reconciliation()).isNull();
    }

    @Test
    void rejectsUnknownDemoScenario() {
        DemoScenarioController controller =
                new DemoScenarioController(payments, recipients, reconciliation);

        org.assertj.core.api.Assertions.assertThatThrownBy(
                        () -> controller.run("unknown"))
                .isInstanceOf(UnknownScenarioException.class);
    }

    private PaymentSnapshot snapshot(PaymentStatus status) {
        return snapshot(UUID.randomUUID(), status);
    }

    private PaymentSnapshot snapshot(UUID id, PaymentStatus status) {
        return new PaymentSnapshot(
                id,
                PaymentReference.of(id),
                UUID.randomUUID(),
                UUID.randomUUID(),
                1_000,
                "USD",
                "API test",
                status,
                RiskDecision.APPROVED,
                0,
                List.of(),
                Instant.now(),
                Instant.now());
    }
}
