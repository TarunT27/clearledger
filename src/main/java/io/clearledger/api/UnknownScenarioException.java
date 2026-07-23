package io.clearledger.api;

public class UnknownScenarioException extends RuntimeException {
    public UnknownScenarioException(String scenario) {
        super("Unknown demo scenario: " + scenario);
    }
}
