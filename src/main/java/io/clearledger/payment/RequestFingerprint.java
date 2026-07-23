package io.clearledger.payment;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

public final class RequestFingerprint {

    private RequestFingerprint() {}

    public static String sha256(PaymentRequestData request) {
        String canonical =
                String.join(
                        "|",
                        request.senderId().toString(),
                        request.recipientId().toString(),
                        Long.toString(request.amountMinor()),
                        request.currency(),
                        request.description());
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of()
                    .formatHex(digest.digest(canonical.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is not available", exception);
        }
    }
}
