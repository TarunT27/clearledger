package io.clearledger.risk;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Set;
import org.junit.jupiter.api.Test;

class RiskEngineTest {

    private final RiskEngine riskEngine = new RiskEngine();

    @Test
    void approvesOrdinaryPaymentToEstablishedRecipient() {
        RiskContext context = new RiskContext(75_000, 0, true, 125_000);

        RiskAssessment assessment = riskEngine.assess(context);

        assertThat(assessment.decision()).isEqualTo(RiskDecision.APPROVED);
        assertThat(assessment.score()).isZero();
        assertThat(triggeredCodes(assessment)).isEmpty();
    }

    @Test
    void routesUnusualAmountToReview() {
        RiskAssessment assessment =
                riskEngine.assess(new RiskContext(1_000_000, 0, true, 0));

        assertThat(assessment.decision()).isEqualTo(RiskDecision.REVIEW);
        assertThat(triggeredCodes(assessment)).containsExactly("UNUSUAL_AMOUNT");
    }

    @Test
    void routesRepeatedAttemptsToReview() {
        RiskAssessment assessment =
                riskEngine.assess(new RiskContext(25_000, 3, true, 0));

        assertThat(assessment.decision()).isEqualTo(RiskDecision.REVIEW);
        assertThat(triggeredCodes(assessment)).containsExactly("REPEATED_ATTEMPTS");
    }

    @Test
    void routesNewRecipientToReview() {
        RiskAssessment assessment =
                riskEngine.assess(new RiskContext(25_000, 0, false, 0));

        assertThat(assessment.decision()).isEqualTo(RiskDecision.REVIEW);
        assertThat(triggeredCodes(assessment)).containsExactly("NEW_RECIPIENT");
    }

    @Test
    void rejectsPaymentThatBreachesVelocityLimit() {
        RiskAssessment assessment =
                riskEngine.assess(new RiskContext(100_001, 0, true, 2_400_000));

        assertThat(assessment.decision()).isEqualTo(RiskDecision.REJECTED);
        assertThat(triggeredCodes(assessment)).containsExactly("VELOCITY_LIMIT");
    }

    private Set<String> triggeredCodes(RiskAssessment assessment) {
        return assessment.signals().stream()
                .filter(RiskSignal::triggered)
                .map(RiskSignal::code)
                .collect(java.util.stream.Collectors.toUnmodifiableSet());
    }
}
