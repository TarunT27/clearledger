package io.clearledger.ledger;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "journal_entries")
public class JournalEntryEntity {
    @Id private UUID id;
    @Column(name = "journal_id", nullable = false) private UUID journalId;
    @Column(name = "account_id", nullable = false, length = 80) private String accountId;
    @Enumerated(EnumType.STRING) @Column(nullable = false) private EntryDirection direction;
    @Column(name = "amount_minor", nullable = false) private long amountMinor;
    @Column(nullable = false, length = 3) private String currency;
    @Column(name = "created_at", nullable = false) private Instant createdAt;

    protected JournalEntryEntity() {}

    public JournalEntryEntity(
            UUID id,
            UUID journalId,
            String accountId,
            EntryDirection direction,
            long amountMinor,
            String currency,
            Instant createdAt) {
        this.id = id;
        this.journalId = journalId;
        this.accountId = accountId;
        this.direction = direction;
        this.amountMinor = amountMinor;
        this.currency = currency;
        this.createdAt = createdAt;
    }

    public String getAccountId() { return accountId; }
    public EntryDirection getDirection() { return direction; }
    public long getAmountMinor() { return amountMinor; }
    public String getCurrency() { return currency; }
}
