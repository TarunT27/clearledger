package io.clearledger.console;

import static org.assertj.core.api.Assertions.assertThat;

import io.clearledger.payment.PaymentReference;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class ConsoleVocabularyTest {

    @Test
    void namesEveryRiskSignalTheEngineCanEmit() {
        assertThat(ConsoleVocabulary.RISK_SIGNAL_CODES)
                .containsExactly(
                        "UNUSUAL_AMOUNT", "REPEATED_ATTEMPTS", "NEW_RECIPIENT", "VELOCITY_LIMIT");
        for (String code : ConsoleVocabulary.RISK_SIGNAL_CODES) {
            assertThat(ConsoleVocabulary.riskSignalLabel(code)).doesNotContain("_");
            assertThat(ConsoleVocabulary.riskSignalExplanation(code)).endsWith(".");
        }
    }

    @Test
    void humanizesAnUnknownCodeInsteadOfLeakingTheEnumName() {
        assertThat(ConsoleVocabulary.riskSignalLabel("FUTURE_RULE")).isEqualTo("Future rule");
        assertThat(ConsoleVocabulary.auditLabel("SOMETHING_NEW")).isEqualTo("Something new");
        assertThat(ConsoleVocabulary.auditTone("SOMETHING_NEW")).isEqualTo("neutral");
    }

    @Test
    void tonesSeparateProgressFromTroubleForEveryEventTheSystemWrites() {
        assertThat(ConsoleVocabulary.auditTone("JOURNAL_POSTED")).isEqualTo("success");
        assertThat(ConsoleVocabulary.auditTone("PAYMENT_FINALIZED")).isEqualTo("success");
        assertThat(ConsoleVocabulary.auditTone("RECONCILIATION_REPAIRED")).isEqualTo("success");
        assertThat(ConsoleVocabulary.auditTone("RECONCILIATION_REQUIRED")).isEqualTo("warning");
        assertThat(ConsoleVocabulary.auditTone("RECONCILIATION_FLAGGED")).isEqualTo("warning");
        assertThat(ConsoleVocabulary.auditTone("IDEMPOTENT_REPLAY")).isEqualTo("info");
        assertThat(ConsoleVocabulary.auditLabel("IDEMPOTENT_REPLAY")).isEqualTo("Idempotent replay");
    }

    @Test
    void referencesAreShortStableAndDerivedFromTheIdentifier() {
        UUID id = UUID.fromString("8c42a1f0-1111-4222-8333-444455556666");

        assertThat(PaymentReference.of(id)).isEqualTo("PAY-8C426666");
        assertThat(PaymentReference.of(id)).isEqualTo(PaymentReference.of(id));
        assertThat(ConsoleVocabulary.journalReference(id)).isEqualTo("JRN-8C426666");
        assertThat(PaymentReference.of(id)).hasSize(12);
    }

    @Test
    void distinctIdentifiersGetDistinctReferencesAcrossALargeSample() {
        var references = new java.util.HashSet<String>();
        for (int index = 0; index < 5_000; index++) {
            references.add(PaymentReference.of(UUID.randomUUID()));
        }
        // 32 hex bits of entropy; a handful of collisions in 5,000 draws would still be
        // expected, but the reference must not be constant.
        assertThat(references).hasSizeGreaterThan(4_990);
    }
}
