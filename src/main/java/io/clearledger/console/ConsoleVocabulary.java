package io.clearledger.console;

import java.util.List;
import java.util.Locale;
import java.util.UUID;

/**
 * Turns the engine's internal codes into the words an operator reads.
 *
 * <p>Keeping this on the server rather than in the browser means the console, the audit
 * export, and any future report all describe the same event with the same sentence.
 */
public final class ConsoleVocabulary {

    private ConsoleVocabulary() {}

    /** Every risk rule the engine can trigger, in the order the console lists them. */
    public static final List<String> RISK_SIGNAL_CODES =
            List.of("UNUSUAL_AMOUNT", "REPEATED_ATTEMPTS", "NEW_RECIPIENT", "VELOCITY_LIMIT");

    public static String riskSignalLabel(String code) {
        return switch (code) {
            case "UNUSUAL_AMOUNT" -> "Unusual amount";
            case "REPEATED_ATTEMPTS" -> "Repeated attempts";
            case "NEW_RECIPIENT" -> "New recipient";
            case "VELOCITY_LIMIT" -> "Velocity limit";
            default -> humanize(code);
        };
    }

    public static String riskSignalExplanation(String code) {
        return switch (code) {
            case "UNUSUAL_AMOUNT" -> "Amount meets or exceeds the unusual-payment threshold.";
            case "REPEATED_ATTEMPTS" -> "Repeated distinct payment attempts were observed.";
            case "NEW_RECIPIENT" -> "No earlier approved payment to this recipient was found.";
            case "VELOCITY_LIMIT" -> "The sender would exceed the rolling outgoing limit.";
            default -> "Risk signal recorded.";
        };
    }

    public static String auditLabel(String eventType) {
        return switch (eventType) {
            case "PAYMENT_ACCEPTED" -> "Payment accepted";
            case "JOURNAL_POSTED" -> "Journal posted";
            case "PAYMENT_FINALIZED" -> "Payment finalized";
            case "IDEMPOTENT_REPLAY" -> "Idempotent replay";
            case "RECONCILIATION_REQUIRED" -> "Reconciliation required";
            case "RECONCILIATION_REPAIRED" -> "Reconciliation repaired";
            case "RECONCILIATION_FINALIZED" -> "Reconciliation finalized";
            case "RECONCILIATION_FLAGGED" -> "Reconciliation flagged";
            default -> humanize(eventType);
        };
    }

    /** Presentation tone the console maps to a colour. */
    public static String auditTone(String eventType) {
        return switch (eventType) {
            case "JOURNAL_POSTED", "PAYMENT_FINALIZED", "RECONCILIATION_REPAIRED",
                            "RECONCILIATION_FINALIZED" ->
                    "success";
            case "RECONCILIATION_REQUIRED", "RECONCILIATION_FLAGGED" -> "warning";
            case "IDEMPOTENT_REPLAY" -> "info";
            default -> "neutral";
        };
    }

    /** Short, stable, human-quotable handle for a payment, e.g. {@code PAY-8C42}. */
    public static String paymentReference(UUID paymentId) {
        String hex = paymentId.toString().replace("-", "").toUpperCase(Locale.ROOT);
        return "PAY-" + hex.substring(0, 4) + hex.substring(28, 32);
    }

    public static String journalReference(UUID journalId) {
        String hex = journalId.toString().replace("-", "").toUpperCase(Locale.ROOT);
        return "JRN-" + hex.substring(0, 4) + hex.substring(28, 32);
    }

    private static String humanize(String code) {
        String lower = code.toLowerCase(Locale.ROOT).replace('_', ' ');
        return lower.isEmpty() ? lower : Character.toUpperCase(lower.charAt(0)) + lower.substring(1);
    }
}
