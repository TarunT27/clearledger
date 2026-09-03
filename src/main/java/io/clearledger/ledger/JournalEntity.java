package io.clearledger.ledger;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "journals")
public class JournalEntity {
    @Id private UUID id;
    @Column(name = "payment_id", nullable = false, unique = true) private UUID paymentId;
    @Column(name = "created_at", nullable = false) private Instant createdAt;

    protected JournalEntity() {}

    public JournalEntity(UUID id, UUID paymentId, Instant createdAt) {
        this.id = id;
        this.paymentId = paymentId;
        this.createdAt = createdAt;
    }

    public UUID getId() { return id; }
    public UUID getPaymentId() { return paymentId; }
    public Instant getCreatedAt() { return createdAt; }
}
