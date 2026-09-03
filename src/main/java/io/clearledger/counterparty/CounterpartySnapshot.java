package io.clearledger.counterparty;

import java.util.UUID;

/** A counterparty as the operations console displays it. */
public record CounterpartySnapshot(
        UUID id,
        String displayName,
        String legalName,
        String reference,
        String category,
        String country,
        CounterpartyRole role) {

    /**
     * Placeholder for an identifier that has no counterparty row. Payments created by the
     * scenario lab use throwaway UUIDs on purpose, and the console must still render them.
     */
    public static CounterpartySnapshot unknown(UUID id) {
        return new CounterpartySnapshot(
                id,
                "Unregistered party",
                "Unregistered party",
                shortReference(id),
                "Unregistered",
                "US",
                CounterpartyRole.RECIPIENT);
    }

    public static String shortReference(UUID id) {
        return id.toString().substring(0, 8).toUpperCase(java.util.Locale.ROOT);
    }
}
