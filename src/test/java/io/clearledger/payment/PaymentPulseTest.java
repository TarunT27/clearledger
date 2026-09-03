package io.clearledger.payment;

import static org.assertj.core.api.Assertions.assertThat;

import io.clearledger.risk.RiskDecision;
import java.time.Instant;
import org.junit.jupiter.api.Test;

class PaymentPulseTest {

    private PaymentPulse pulse(String signals) {
        return new PaymentPulse(
                Instant.parse("2026-09-03T12:00:00Z"),
                PaymentStatus.APPROVED,
                RiskDecision.APPROVED,
                25_000,
                signals);
    }

    @Test
    void readsTheStoredSignalListWithoutInventingEmptyCodes() {
        assertThat(pulse("UNUSUAL_AMOUNT,NEW_RECIPIENT").signalCodes())
                .containsExactly("UNUSUAL_AMOUNT", "NEW_RECIPIENT");
        assertThat(pulse("NEW_RECIPIENT").signalCodes()).containsExactly("NEW_RECIPIENT");
    }

    @Test
    void treatsBlankNullAndEmptyStorageAsNoSignals() {
        assertThat(pulse("").signalCodes()).isEmpty();
        assertThat(pulse("   ").signalCodes()).isEmpty();
        assertThat(pulse(null).signalCodes()).isEmpty();
        assertThat(pulse(",,").signalCodes()).isEmpty();
    }
}
