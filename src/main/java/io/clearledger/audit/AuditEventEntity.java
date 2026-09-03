package io.clearledger.audit;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "audit_events")
public class AuditEventEntity {
    @Id private UUID id;
    @Column(name = "payment_id") private UUID paymentId;
    @Column(name = "event_type", nullable = false, length = 64) private String eventType;
    @Column(nullable = false, length = 64) private String actor;
    @Column(nullable = false, length = 1000) private String detail;
    @Column(name = "created_at", nullable = false) private Instant createdAt;

    protected AuditEventEntity() {}

    public AuditEventEntity(
            UUID id,
            UUID paymentId,
            String eventType,
            String actor,
            String detail,
            Instant createdAt) {
        this.id = id;
        this.paymentId = paymentId;
        this.eventType = eventType;
        this.actor = actor;
        this.detail = detail;
        this.createdAt = createdAt;
    }

    public UUID getId() { return id; }
    public UUID getPaymentId() { return paymentId; }
    public String getEventType() { return eventType; }
    public String getActor() { return actor; }
    public String getDetail() { return detail; }
    public Instant getCreatedAt() { return createdAt; }

    public AuditEventSnapshot snapshot() {
        return new AuditEventSnapshot(id, paymentId, eventType, actor, detail, createdAt);
    }
}
