package io.clearledger.payment;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertAll;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.httpBasic;

import io.clearledger.ledger.JournalEntryRepository;
import io.clearledger.ledger.JournalRepository;
import io.clearledger.reconciliation.ReconciliationService;
import io.clearledger.audit.AuditEventRepository;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.Executors;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers(disabledWithoutDocker = true)
@SpringBootTest(
        properties = {
            "clearledger.reconciliation.enabled=false",
            "clearledger.demo.enabled=false",
            "spring.security.user.password=integration-password"
        })
@AutoConfigureMockMvc
class PaymentApiIntegrationTest {

    private static final UUID SENDER = UUID.fromString("10000000-0000-0000-0000-000000000001");
    private static final UUID RECIPIENT = UUID.fromString("20000000-0000-0000-0000-000000000001");

    @Container
    static final PostgreSQLContainer<?> POSTGRES =
            new PostgreSQLContainer<>("postgres:17-alpine");

    @DynamicPropertySource
    static void database(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
    }

    @Autowired PaymentService paymentService;
    @Autowired PaymentRepository paymentRepository;
    @Autowired JournalRepository journalRepository;
    @Autowired JournalEntryRepository journalEntryRepository;
    @Autowired AuditEventRepository auditEventRepository;
    @Autowired ReconciliationService reconciliationService;
    @Autowired MockMvc mockMvc;

    @BeforeEach
    void clean() {
        auditEventRepository.deleteAll();
        journalEntryRepository.deleteAll();
        journalRepository.deleteAll();
        paymentRepository.deleteAll();
    }

    @Test
    void normalPaymentCompletesWithOneBalancedJournal() {
        PaymentSnapshot result =
                paymentService.create(request(25_000), "normal-1", ProcessingFault.NONE).payment();

        assertAll(
                () -> assertThat(result.status()).isEqualTo(PaymentStatus.APPROVED),
                () -> assertThat(paymentRepository.count()).isOne(),
                () -> assertThat(journalRepository.count()).isOne(),
                () -> assertThat(journalEntryRepository.count()).isEqualTo(2));
    }

    @Test
    void restApiReturnsCreatedEnvelopeAndSecurityHeaders() throws Exception {
        mockMvc.perform(
                        post("/api/v1/payments")
                                .with(httpBasic("clearledger-operator", "integration-password"))
                                .header("Idempotency-Key", "http-integration-key")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        """
                                        {
                                          "senderId": "10000000-0000-0000-0000-000000000001",
                                          "recipientId": "20000000-0000-0000-0000-000000000001",
                                          "amountMinor": 25000,
                                          "currency": "USD",
                                          "description": "HTTP integration test"
                                        }
                                        """))
                .andExpect(status().isCreated())
                .andExpect(header().exists("X-Correlation-Id"))
                .andExpect(header().string("X-Content-Type-Options", "nosniff"))
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.status").value("APPROVED"))
                .andExpect(jsonPath("$.meta.duplicate").value(false));
    }

    @Test
    void nonDemoApiRejectsAnonymousPaymentCreation() throws Exception {
        mockMvc.perform(
                        post("/api/v1/payments")
                                .header("Idempotency-Key", "anonymous-http-key")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        """
                                        {
                                          "senderId": "10000000-0000-0000-0000-000000000001",
                                          "recipientId": "20000000-0000-0000-0000-000000000001",
                                          "amountMinor": 25000,
                                          "currency": "USD",
                                          "description": "Anonymous integration test"
                                        }
                                        """))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void duplicateConcurrentRequestsReturnOnePaymentAndOneJournal() throws Exception {
        var pool = Executors.newFixedThreadPool(2);
        try {
            Callable<PaymentCreationResult> call =
                    () -> paymentService.create(request(25_000), "same-key", ProcessingFault.NONE);
            var results = pool.invokeAll(java.util.List.of(call, call));

            assertAll(
                    () -> assertThat(results.get(0).get().payment().id())
                            .isEqualTo(results.get(1).get().payment().id()),
                    () -> assertThat(paymentRepository.count()).isOne(),
                    () -> assertThat(journalRepository.count()).isOne(),
                    () -> assertThat(journalEntryRepository.count()).isEqualTo(2));
        } finally {
            pool.shutdownNow();
        }
    }

    @Test
    void sameKeyWithDifferentPayloadIsConflict() {
        paymentService.create(request(25_000), "conflict-key", ProcessingFault.NONE);

        var exception =
                org.assertj.core.api.Assertions.catchThrowable(
                        () -> paymentService.create(request(25_001), "conflict-key", ProcessingFault.NONE));

        assertThat(exception).isInstanceOf(IdempotencyConflictException.class);
    }

    @Test
    void reconciliationFinalizesTimeoutWithoutDuplicatingJournal() {
        var timeout =
                org.assertj.core.api.Assertions.catchThrowable(
                        () -> paymentService.create(request(25_000), "timeout-1", ProcessingFault.AFTER_LEDGER_COMMIT));
        PaymentSnapshot pending = paymentService.list(PaymentStatus.PENDING, 20).getFirst();

        ReconciliationService.ReconciliationRun run = reconciliationService.reconcile();
        PaymentSnapshot repaired = paymentService.get(pending.id());

        assertAll(
                () -> assertThat(timeout).isInstanceOf(SimulatedTimeoutException.class),
                () -> assertThat(pending.status()).isEqualTo(PaymentStatus.PENDING),
                () -> assertThat(repaired.status()).isEqualTo(PaymentStatus.APPROVED),
                () -> assertThat(run.repaired()).isEqualTo(1),
                () -> assertThat(journalRepository.count()).isOne(),
                () -> assertThat(journalEntryRepository.count()).isEqualTo(2));
    }

    private CreatePaymentRequest request(long amount) {
        return new CreatePaymentRequest(SENDER, RECIPIENT, amount, "USD", "Integration test");
    }
}
