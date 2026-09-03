package io.clearledger.console;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertAll;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.httpBasic;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import io.clearledger.audit.AuditEventRepository;
import io.clearledger.counterparty.CounterpartyRepository;
import io.clearledger.counterparty.CounterpartyRole;
import io.clearledger.ledger.JournalEntryRepository;
import io.clearledger.ledger.JournalRepository;
import io.clearledger.payment.CreatePaymentRequest;
import io.clearledger.payment.PaymentRepository;
import io.clearledger.payment.PaymentService;
import io.clearledger.payment.PaymentSnapshot;
import io.clearledger.payment.PaymentStatus;
import io.clearledger.payment.ProcessingFault;
import io.clearledger.payment.SimulatedTimeoutException;
import io.clearledger.reconciliation.ReconciliationAction;
import io.clearledger.reconciliation.ReconciliationRunRepository;
import io.clearledger.reconciliation.ReconciliationService;
import io.clearledger.risk.RiskDecision;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * Exercises the console read model against a real PostgreSQL instance.
 *
 * <p>These endpoints exist to answer questions about data the payment path wrote, so every
 * assertion here starts by writing that data through {@link PaymentService} rather than by
 * inserting rows. If the read model ever disagrees with what the engine actually did, it is
 * these tests that fail.
 */
@Testcontainers(disabledWithoutDocker = true)
@SpringBootTest(
        properties = {
            "clearledger.reconciliation.enabled=false",
            "clearledger.demo.enabled=false",
            "clearledger.demo.seed-history=false",
            "spring.security.user.password=integration-password"
        })
@AutoConfigureMockMvc
class ConsoleApiIntegrationTest {

    @Container
    static final PostgreSQLContainer<?> POSTGRES =
            new PostgreSQLContainer<>("postgres:17-alpine");

    @DynamicPropertySource
    static void database(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
    }

    private static final UUID SENDER = UUID.fromString("10000000-0000-0000-0000-000000000001");
    private static final List<UUID> SENDERS =
            List.of(
                    UUID.fromString("10000000-0000-0000-0000-000000000001"),
                    UUID.fromString("10000000-0000-0000-0000-000000000002"),
                    UUID.fromString("10000000-0000-0000-0000-000000000003"));
    private static final UUID KNOWN_PAYEE =
            UUID.fromString("20000000-0000-0000-0000-000000000001");
    /** Deliberately left out of established_recipients by V2 so NEW_RECIPIENT fires. */
    private static final UUID NEW_PAYEE = UUID.fromString("20000000-0000-0000-0000-00000000000b");

    @Autowired PaymentService payments;
    @Autowired ConsoleService console;
    @Autowired PaymentRepository paymentRepository;
    @Autowired JournalRepository journalRepository;
    @Autowired JournalEntryRepository journalEntryRepository;
    @Autowired AuditEventRepository auditEventRepository;
    @Autowired CounterpartyRepository counterpartyRepository;
    @Autowired ReconciliationService reconciliation;
    @Autowired ReconciliationRunRepository reconciliationRuns;
    @Autowired MockMvc mockMvc;

    @BeforeEach
    void clean() {
        reconciliationRuns.deleteAll();
        auditEventRepository.deleteAll();
        journalEntryRepository.deleteAll();
        journalRepository.deleteAll();
        paymentRepository.deleteAll();
    }

    private PaymentSnapshot create(UUID recipient, long amountMinor, String description) {
        return create(SENDER, recipient, amountMinor, description);
    }

    private PaymentSnapshot create(
            UUID sender, UUID recipient, long amountMinor, String description) {
        return payments
                .create(
                        new CreatePaymentRequest(sender, recipient, amountMinor, "USD", description),
                        "console-" + UUID.randomUUID(),
                        ProcessingFault.NONE)
                .payment();
    }

    /**
     * Writes {@code count} approved payments, rotating senders so the repeated-attempts
     * rule (three from one sender inside ten minutes) does not divert them to review.
     */
    private void approvedBook(int count, String description) {
        for (int index = 0; index < count; index++) {
            create(
                    SENDERS.get(index % SENDERS.size()),
                    KNOWN_PAYEE,
                    10_000L + index,
                    description + " " + index);
        }
    }

    @Test
    void migrationShipsCounterpartiesSoTheConsoleCanNamePartiesInsteadOfPrintingUuids() {
        assertAll(
                () ->
                        assertThat(console.counterparties(CounterpartyRole.SENDER))
                                .isNotEmpty()
                                .allSatisfy(
                                        party ->
                                                assertThat(party.displayName()).isNotBlank()),
                () -> assertThat(console.counterparties(CounterpartyRole.RECIPIENT)).hasSize(14),
                () -> assertThat(counterpartyRepository.count()).isEqualTo(17));
    }

    @Test
    void paymentRowsCarryCounterpartyNamesAndJournalState() {
        PaymentSnapshot created = create(KNOWN_PAYEE, 25_000, "Invoice CL-1001");

        ConsolePage<PaymentRow> result =
                console.payments(
                        new PaymentQuery(null, null, null, null, null, false, "createdAt", null),
                        0,
                        20);

        assertThat(result.items()).hasSize(1);
        PaymentRow row = result.items().get(0);
        assertAll(
                () -> assertThat(row.id()).isEqualTo(created.id()),
                () -> assertThat(row.reference()).startsWith("PAY-"),
                () -> assertThat(row.sender().displayName()).isEqualTo("Atlas Operating"),
                () -> assertThat(row.recipient().displayName()).isEqualTo("Northstar Supplies"),
                () -> assertThat(row.journalPosted()).isTrue(),
                () -> assertThat(row.journalId()).isNotNull(),
                () -> assertThat(row.status()).isEqualTo(PaymentStatus.APPROVED));
    }

    @Test
    void searchMatchesOnCounterpartyNameEvenThoughThePaymentOnlyStoresAnIdentifier() {
        create(KNOWN_PAYEE, 25_000, "Invoice CL-1001");
        create(NEW_PAYEE, 31_000, "Invoice CL-1002");

        ConsolePage<PaymentRow> matched =
                console.payments(
                        new PaymentQuery(
                                "northstar", null, null, null, null, false, "createdAt", null),
                        0,
                        20);

        assertThat(matched.totalItems()).isEqualTo(1);
        assertThat(matched.items().get(0).recipient().displayName()).isEqualTo("Northstar Supplies");
    }

    @Test
    void filteringAndPagingHappenInTheDatabaseSoTheFooterCountIsTheRealCount() {
        approvedBook(7, "Invoice CL-20");

        ConsolePage<PaymentRow> firstPage =
                console.payments(
                        new PaymentQuery(
                                null,
                                PaymentStatus.APPROVED,
                                null,
                                null,
                                null,
                                false,
                                "amountMinor",
                                org.springframework.data.domain.Sort.Direction.ASC),
                        0,
                        3);
        ConsolePage<PaymentRow> secondPage =
                console.payments(
                        new PaymentQuery(
                                null,
                                PaymentStatus.APPROVED,
                                null,
                                null,
                                null,
                                false,
                                "amountMinor",
                                org.springframework.data.domain.Sort.Direction.ASC),
                        1,
                        3);

        assertAll(
                () -> assertThat(firstPage.items()).hasSize(3),
                () -> assertThat(firstPage.totalItems()).isEqualTo(7),
                () -> assertThat(firstPage.totalPages()).isEqualTo(3),
                () -> assertThat(firstPage.hasNext()).isTrue(),
                () -> assertThat(firstPage.hasPrevious()).isFalse(),
                () ->
                        assertThat(firstPage.items())
                                .extracting(PaymentRow::amountMinor)
                                .isSorted(),
                () ->
                        assertThat(secondPage.items().get(0).amountMinor())
                                .isGreaterThan(firstPage.items().get(2).amountMinor()));
    }

    @Test
    void riskSignalFilterFindsThePaymentsThatRuleActuallyFiredOn() {
        create(KNOWN_PAYEE, 25_000, "Ordinary invoice");
        PaymentSnapshot flagged = create(NEW_PAYEE, 31_000, "First payment to a new payee");

        ConsolePage<PaymentRow> matched =
                console.payments(
                        new PaymentQuery(
                                null, null, null, "NEW_RECIPIENT", null, false, "createdAt", null),
                        0,
                        20);

        assertThat(matched.totalItems()).isEqualTo(1);
        assertThat(matched.items().get(0).id()).isEqualTo(flagged.id());
        assertThat(flagged.riskDecision()).isEqualTo(RiskDecision.REVIEW);
    }

    @Test
    void aBurstFromOneSenderTripsTheRepeatedAttemptsRuleAndShowsUpInTheSignalFilter() {
        for (int index = 0; index < 5; index++) {
            create(KNOWN_PAYEE, 10_000 + index, "Burst " + index);
        }

        ConsolePage<PaymentRow> repeated =
                console.payments(
                        new PaymentQuery(
                                null,
                                null,
                                null,
                                "REPEATED_ATTEMPTS",
                                null,
                                false,
                                "createdAt",
                                null),
                        0,
                        20);

        // The rule counts attempts already on record, so the first three clear it and the
        // fourth and fifth trip it. That is why the console's book is built across senders
        // rather than in one tight loop.
        assertThat(repeated.totalItems()).isEqualTo(2);
        assertThat(repeated.items())
                .allSatisfy(row -> assertThat(row.status()).isEqualTo(PaymentStatus.REVIEW));
    }

    @Test
    void paymentDetailReportsEveryRuleEvaluatedNotJustTheOnesThatFired() {
        PaymentSnapshot created = create(NEW_PAYEE, 31_000, "New payee invoice");

        PaymentDetail detail = console.payment(created.id());

        assertAll(
                () -> assertThat(detail.riskSignals()).hasSize(4),
                () ->
                        assertThat(detail.riskSignals())
                                .filteredOn(PaymentDetail.RiskSignalDetail::triggered)
                                .extracting(PaymentDetail.RiskSignalDetail::code)
                                .containsExactly("NEW_RECIPIENT"),
                () ->
                        assertThat(detail.riskSignals())
                                .allSatisfy(
                                        signal ->
                                                assertThat(signal.explanation()).isNotBlank()),
                () -> assertThat(detail.audit()).isNotEmpty(),
                () ->
                        assertThat(detail.audit())
                                .extracting(AuditEventView::eventType)
                                .contains("PAYMENT_ACCEPTED", "PAYMENT_FINALIZED"));
    }

    @Test
    void anApprovedPaymentsJournalIsBalancedAndAttributedToNamedAccounts() {
        PaymentSnapshot created = create(KNOWN_PAYEE, 25_000, "Invoice CL-1001");

        JournalView journal = console.payment(created.id()).journal();

        assertThat(journal).isNotNull();
        assertAll(
                () -> assertThat(journal.reference()).startsWith("JRN-"),
                () -> assertThat(journal.totalDebitsMinor()).isEqualTo(25_000),
                () -> assertThat(journal.totalCreditsMinor()).isEqualTo(25_000),
                () -> assertThat(journal.balanced()).isTrue(),
                () -> assertThat(journal.matchesPayment()).isTrue(),
                () -> assertThat(journal.lines()).hasSize(2),
                () ->
                        assertThat(journal.lines())
                                .extracting(JournalView.Line::accountLabel)
                                .containsExactlyInAnyOrder(
                                        "Atlas Operating", "Northstar Supplies"));
    }

    @Test
    void aRejectedOrReviewedPaymentHasNoJournalBecauseNoMoneyMoved() {
        PaymentSnapshot reviewed = create(NEW_PAYEE, 31_000, "New payee invoice");

        PaymentDetail detail = console.payment(reviewed.id());

        assertThat(detail.payment().status()).isEqualTo(PaymentStatus.REVIEW);
        assertThat(detail.journal()).isNull();
        assertThat(detail.payment().journalPosted()).isFalse();
    }

    @Test
    void journalSearchRunsInTheDatabaseSoPageTwoIsStillTheSameSearch() {
        approvedBook(5, "Freight settlement");
        create(SENDERS.get(2), KNOWN_PAYEE, 44_000, "Unrelated memo");

        ConsolePage<JournalView> matched = console.journals("freight", 0, 3);

        assertAll(
                () -> assertThat(matched.totalItems()).isEqualTo(5),
                () -> assertThat(matched.items()).hasSize(3),
                () -> assertThat(matched.hasNext()).isTrue(),
                () -> assertThat(console.journals("freight", 1, 3).items()).hasSize(2),
                () -> assertThat(console.journals("nothing-matches", 0, 3).totalItems()).isZero());
    }

    @Test
    void overviewCountsComeFromTheLedgerRatherThanFromTheBrowser() {
        create(SENDERS.get(0), KNOWN_PAYEE, 25_000, "Invoice CL-1001");
        create(SENDERS.get(1), KNOWN_PAYEE, 30_000, "Invoice CL-1002");
        create(SENDERS.get(2), NEW_PAYEE, 31_000, "New payee invoice");

        OverviewReport report = console.overview("24h");

        assertAll(
                () -> assertThat(report.range()).isEqualTo("24h"),
                () ->
                        assertThat(report.metrics())
                                .extracting(OverviewReport.Metric::key)
                                .containsExactly(
                                        "processedVolume",
                                        "approvalRate",
                                        "manualReview",
                                        "openExceptions"),
                () ->
                        assertThat(metric(report, "processedVolume").value())
                                .isEqualTo(86_000.0),
                () -> assertThat(metric(report, "manualReview").value()).isEqualTo(1.0),
                () -> assertThat(metric(report, "manualReview").preferHigher()).isFalse(),
                () -> assertThat(report.ledgerHealth().journals()).isEqualTo(2),
                () -> assertThat(report.ledgerHealth().balancedJournals()).isEqualTo(2),
                () -> assertThat(report.ledgerHealth().postedVolumeMinor()).isEqualTo(55_000),
                () -> assertThat(report.throughput()).isNotEmpty(),
                () ->
                        assertThat(
                                        report.throughput().stream()
                                                .mapToLong(OverviewReport.ThroughputBucket::approved)
                                                .sum())
                                .isEqualTo(2));
    }

    @Test
    void anEmptyPriorWindowReportsNoComparisonRatherThanAnInfiniteRise() {
        create(KNOWN_PAYEE, 25_000, "Invoice CL-1001");

        OverviewReport report = console.overview("24h");

        assertThat(metric(report, "processedVolume").deltaPercent()).isNull();
        assertThat(metric(report, "openExceptions").deltaPercent()).isNull();
    }

    @Test
    void riskReportPublishesTheThresholdsTheEngineIsRunningWith() {
        create(NEW_PAYEE, 31_000, "New payee invoice");

        RiskReport report = console.risk("24h");

        assertAll(
                () -> assertThat(report.policy().unusualAmountMinor()).isEqualTo(1_000_000),
                () -> assertThat(report.policy().velocityLimitMinor()).isEqualTo(2_500_000),
                () -> assertThat(report.policy().reviewScoreThreshold()).isEqualTo(40),
                () -> assertThat(report.policy().repeatedAttemptLimit()).isEqualTo(3),
                () -> assertThat(report.assessedPayments()).isEqualTo(1),
                () -> assertThat(report.reviewQueue()).hasSize(1),
                () -> assertThat(report.rejectedQueue()).isEmpty(),
                () ->
                        assertThat(report.signals())
                                .filteredOn(signal -> signal.count() > 0)
                                .extracting(OverviewReport.SignalActivity::code)
                                .containsExactly("NEW_RECIPIENT"));
    }

    @Test
    void aTimedOutPaymentBecomesAReconciliationCaseCarryingItsCommittedJournal() {
        UUID paymentId = timeOutAfterLedgerCommit();

        ReconciliationBoard board = console.reconciliationBoard();

        assertThat(board.cases()).hasSize(1);
        ReconciliationBoard.Case open = board.cases().get(0);
        assertAll(
                () -> assertThat(open.paymentId()).isEqualTo(paymentId),
                () -> assertThat(open.journalPosted()).isTrue(),
                () -> assertThat(open.balanced()).isTrue(),
                () -> assertThat(open.matchesPayment()).isTrue(),
                () -> assertThat(open.journal()).isNotNull(),
                () ->
                        assertThat(open.plannedAction())
                                .isEqualTo(ReconciliationAction.FINALIZE_APPROVED),
                () -> assertThat(open.repairStrategy()).contains("compare-and-swap"),
                () ->
                        assertThat(open.evidence())
                                .extracting(AuditEventView::eventType)
                                .contains("JOURNAL_POSTED", "RECONCILIATION_REQUIRED"),
                () -> assertThat(board.stats().openCases()).isEqualTo(1),
                () -> assertThat(board.stats().repairableNow()).isEqualTo(1),
                () -> assertThat(board.stats().workerEnabled()).isFalse());
    }

    @Test
    void repairingACaseFinalizesItWithoutWritingASecondJournal() {
        UUID paymentId = timeOutAfterLedgerCommit();
        long journalsBefore = journalRepository.count();

        ReconciliationService.RepairOutcome outcome = console.repair(paymentId);

        assertAll(
                () ->
                        assertThat(outcome.action())
                                .isEqualTo(ReconciliationAction.FINALIZE_APPROVED),
                () -> assertThat(outcome.status()).isEqualTo(PaymentStatus.APPROVED),
                () -> assertThat(outcome.alreadyResolved()).isFalse(),
                () ->
                        assertThat(outcome.committedVersion())
                                .isEqualTo(outcome.observedVersion() + 1),
                () -> assertThat(journalRepository.count()).isEqualTo(journalsBefore),
                () -> assertThat(console.reconciliationBoard().cases()).isEmpty());
    }

    @Test
    void repairingAnAlreadyFinalPaymentIsANoOpRatherThanASecondWrite() {
        UUID paymentId = timeOutAfterLedgerCommit();
        console.repair(paymentId);

        ReconciliationService.RepairOutcome second = console.repair(paymentId);

        assertAll(
                () -> assertThat(second.alreadyResolved()).isTrue(),
                () -> assertThat(second.action()).isEqualTo(ReconciliationAction.NO_OP),
                () -> assertThat(second.narrative()).contains("no second write"),
                () -> assertThat(journalRepository.count()).isEqualTo(1));
    }

    @Test
    void reconciliationRunsArePersistedSoTheConsoleCanShowWhetherTheWorkerRan() {
        timeOutAfterLedgerCommit();

        console.repair(paymentRepository.findByStatusOrderByCreatedAtAsc(PaymentStatus.PENDING)
                .get(0)
                .getId());
        List<ReconciliationService.ReconciliationRun> history = reconciliation.history(10);

        assertThat(history).isNotEmpty();
        assertThat(history.get(0).repaired()).isEqualTo(1);
        assertThat(console.reconciliationBoard().stats().repairedAllTime()).isEqualTo(1);
    }

    @Test
    void auditEventsAreReadableAndFilterableWithOperatorLanguage() {
        create(KNOWN_PAYEE, 25_000, "Invoice CL-1001");

        ConsolePage<AuditEventView> posted = console.auditEvents(null, "JOURNAL_POSTED", 0, 25);
        ConsolePage<AuditEventView> searched = console.auditEvents("balanced", null, 0, 25);

        assertAll(
                () -> assertThat(posted.totalItems()).isEqualTo(1),
                () -> assertThat(posted.items().get(0).label()).isEqualTo("Journal posted"),
                () -> assertThat(posted.items().get(0).tone()).isEqualTo("success"),
                () ->
                        assertThat(posted.items().get(0).paymentReference())
                                .startsWith("PAY-"),
                () -> assertThat(searched.totalItems()).isEqualTo(1),
                () -> assertThat(console.auditEventTypes()).contains("JOURNAL_POSTED"));
    }

    @Test
    void consoleReadEndpointsRequireAuthenticationOutsideTheDemoProfile() throws Exception {
        mockMvc.perform(get("/api/v1/console/overview")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/v1/console/payments")).andExpect(status().isUnauthorized());
        mockMvc.perform(
                        post("/api/v1/console/reconciliation/cases/"
                                + UUID.randomUUID()
                                + "/repair"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void authenticatedOperatorsReadTheConsoleThroughTheStandardEnvelope() throws Exception {
        create(KNOWN_PAYEE, 25_000, "Invoice CL-1001");

        mockMvc.perform(
                        get("/api/v1/console/payments?size=5")
                                .with(httpBasic("clearledger-operator", "integration-password")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.items[0].reference").exists())
                .andExpect(jsonPath("$.data.items[0].recipient.displayName")
                        .value("Northstar Supplies"))
                .andExpect(jsonPath("$.data.totalItems").value(1));

        mockMvc.perform(
                        get("/api/v1/console/overview?range=nonsense")
                                .with(httpBasic("clearledger-operator", "integration-password")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.range").value("24h"));
    }

    /** Drives the real timeout path: journal commits, finalization never observed. */
    private UUID timeOutAfterLedgerCommit() {
        try {
            payments.create(
                    new CreatePaymentRequest(
                            SENDER, KNOWN_PAYEE, 120_000, "USD", "Timed-out settlement"),
                    "console-timeout-" + UUID.randomUUID(),
                    ProcessingFault.AFTER_LEDGER_COMMIT);
            throw new IllegalStateException("Timeout fault was not triggered.");
        } catch (SimulatedTimeoutException expected) {
            return expected.paymentId();
        }
    }

    private OverviewReport.Metric metric(OverviewReport report, String key) {
        return report.metrics().stream()
                .filter(candidate -> candidate.key().equals(key))
                .findFirst()
                .orElseThrow();
    }
}
