package io.clearledger.payment;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.UUID;
import org.junit.jupiter.api.Test;

class RequestFingerprintTest {

    private static final UUID SENDER =
            UUID.fromString("00000000-0000-0000-0000-000000000101");
    private static final UUID RECIPIENT =
            UUID.fromString("00000000-0000-0000-0000-000000000201");

    @Test
    void producesStableFingerprintForEquivalentRequests() {
        PaymentRequestData first =
                new PaymentRequestData(SENDER, RECIPIENT, 75_000, "usd", "  Invoice 1042 ");
        PaymentRequestData second =
                new PaymentRequestData(SENDER, RECIPIENT, 75_000, "USD", "Invoice 1042");

        assertThat(RequestFingerprint.sha256(first))
                .isEqualTo(RequestFingerprint.sha256(second));
    }

    @Test
    void changesFingerprintWhenPaymentIntentChanges() {
        PaymentRequestData original =
                new PaymentRequestData(SENDER, RECIPIENT, 75_000, "USD", "Invoice 1042");
        PaymentRequestData changed =
                new PaymentRequestData(SENDER, RECIPIENT, 75_001, "USD", "Invoice 1042");

        assertThat(RequestFingerprint.sha256(original))
                .isNotEqualTo(RequestFingerprint.sha256(changed));
    }
}
