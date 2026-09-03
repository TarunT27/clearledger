package io.clearledger.reconciliation;

public enum ReconciliationTrigger {
    /** The background worker on its fixed delay. */
    SCHEDULED,
    /** An operator asked for a full sweep. */
    MANUAL,
    /** An operator repaired one specific case from the console. */
    TARGETED
}
