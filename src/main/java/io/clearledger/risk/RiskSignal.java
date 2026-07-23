package io.clearledger.risk;

public record RiskSignal(String code, boolean triggered, int score, String explanation) {}
