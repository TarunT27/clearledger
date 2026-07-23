package io.clearledger.payment;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Size;
import java.util.Locale;
import java.util.UUID;

public record CreatePaymentRequest(
        @NotNull UUID senderId,
        @NotNull UUID recipientId,
        @Positive @Max(100_000_000_000L) long amountMinor,
        @NotBlank @Pattern(regexp = "[A-Za-z]{3}") String currency,
        @NotNull @Size(max = 140) String description) {

    public CreatePaymentRequest {
        currency = currency == null ? null : currency.strip().toUpperCase(Locale.ROOT);
        description = description == null ? null : description.strip();
    }

    PaymentRequestData toData() {
        return new PaymentRequestData(senderId, recipientId, amountMinor, currency, description);
    }

    @AssertTrue(message = "Sender and recipient must be different.")
    public boolean isRecipientDifferentFromSender() {
        return senderId == null || recipientId == null || !senderId.equals(recipientId);
    }
}
