package io.clearledger.risk;

import java.util.List;

public record RiskAssessment(RiskDecision decision, int score, List<RiskSignal> signals) {

    public RiskAssessment {
        signals = List.copyOf(signals);
    }
}
