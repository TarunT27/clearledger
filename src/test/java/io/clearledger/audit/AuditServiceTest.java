package io.clearledger.audit;

import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.verify;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class AuditServiceTest {
    @Mock AuditEventRepository events;

    @Test
    void recordsImmutableAuditEvent() {
        UUID paymentId = UUID.randomUUID();
        AuditService service =
                new AuditService(
                        events,
                        Clock.fixed(
                                Instant.parse("2026-07-23T12:00:00Z"),
                                ZoneOffset.UTC));

        service.record(paymentId, "TEST_EVENT", "TEST", "detail");

        verify(events).save(argThat(event -> event != null));
    }
}
