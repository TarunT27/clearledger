package io.clearledger.audit;

import java.time.Clock;
import java.util.UUID;
import org.springframework.stereotype.Service;

@Service
public class AuditService {
    private final AuditEventRepository events;
    private final Clock clock;

    public AuditService(AuditEventRepository events, Clock clock) {
        this.events = events;
        this.clock = clock;
    }

    public void record(UUID paymentId, String type, String actor, String detail) {
        events.save(
                new AuditEventEntity(
                        UUID.randomUUID(), paymentId, type, actor, detail, clock.instant()));
    }
}
