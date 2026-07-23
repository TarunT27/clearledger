package io.clearledger.api;

import io.clearledger.payment.PaymentService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/dashboard")
public class DashboardController {
    private final PaymentService payments;

    public DashboardController(PaymentService payments) {
        this.payments = payments;
    }

    @GetMapping("/summary")
    public ApiEnvelope<PaymentService.DashboardSummary> summary() {
        return ApiEnvelope.success(payments.dashboard());
    }
}
