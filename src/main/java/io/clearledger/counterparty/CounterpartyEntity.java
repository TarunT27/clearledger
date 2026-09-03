package io.clearledger.counterparty;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "counterparties")
public class CounterpartyEntity {

    @Id private UUID id;
    @Column(name = "display_name", nullable = false, length = 120) private String displayName;
    @Column(name = "legal_name", nullable = false, length = 160) private String legalName;
    @Column(nullable = false, length = 32) private String reference;
    @Column(nullable = false, length = 40) private String category;
    @Column(nullable = false, length = 2) private String country;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 16) private CounterpartyRole role;
    @Column(name = "created_at", nullable = false) private Instant createdAt;

    protected CounterpartyEntity() {}

    public UUID getId() { return id; }
    public String getDisplayName() { return displayName; }
    public CounterpartyRole getRole() { return role; }

    public CounterpartySnapshot snapshot() {
        return new CounterpartySnapshot(
                id, displayName, legalName, reference, category, country, role);
    }
}
