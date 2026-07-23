package io.clearledger.api;

import io.clearledger.payment.CreatePaymentRequest;
import io.clearledger.payment.PaymentCreationResult;
import io.clearledger.payment.PaymentService;
import io.clearledger.payment.PaymentSnapshot;
import io.clearledger.payment.PaymentStatus;
import io.clearledger.payment.ProcessingFault;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/payments")
public class PaymentController {
    private final PaymentService payments;

    public PaymentController(PaymentService payments) {
        this.payments = payments;
    }

    @PostMapping
    public ResponseEntity<ApiEnvelope<PaymentSnapshot>> create(
            @Valid @RequestBody CreatePaymentRequest request,
            @RequestHeader(name = "Idempotency-Key") String idempotencyKey) {
        PaymentCreationResult result =
                payments.create(request, idempotencyKey, ProcessingFault.NONE);
        ApiEnvelope<PaymentSnapshot> body =
                ApiEnvelope.success(
                        result.payment(), Map.of("duplicate", result.duplicate()));
        if (result.duplicate()) {
            return ResponseEntity.ok(body);
        }
        return ResponseEntity.created(
                        URI.create("/api/v1/payments/" + result.payment().id()))
                .body(body);
    }

    @GetMapping("/{id}")
    public ApiEnvelope<PaymentSnapshot> get(@PathVariable UUID id) {
        return ApiEnvelope.success(payments.get(id));
    }

    @GetMapping
    public ApiEnvelope<List<PaymentSnapshot>> list(
            @RequestParam(required = false) PaymentStatus status,
            @RequestParam(defaultValue = "50") int size) {
        List<PaymentSnapshot> result = payments.list(status, size);
        return ApiEnvelope.success(
                result,
                Map.of(
                        "count",
                        result.size(),
                        "limit",
                        Math.min(Math.max(size, 1), 100)));
    }
}
