package io.clearledger.payment;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class IdempotencyKeyHasherTest {

    @Test
    void hashesKeysInsteadOfPersistingTheirPlaintextValue() {
        String hash = IdempotencyKeyHasher.sha256("client-secret-key");

        assertThat(hash).hasSize(64).doesNotContain("client-secret-key");
        assertThat(hash).isEqualTo(IdempotencyKeyHasher.sha256("client-secret-key"));
    }
}
