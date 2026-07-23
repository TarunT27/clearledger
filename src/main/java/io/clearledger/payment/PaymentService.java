package io.clearledger.payment;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

@Service
public class PaymentService {
    private static final Logger log = LoggerFactory.getLogger(PaymentService.class);

    private final PaymentRepository payments;
    private final PaymentInitiationTransaction initiation;
    private final PaymentFinalizationTransaction finalization;
    private final Clock clock;
    private final Counter createdCounter;
    private final Counter duplicateCounter;

    public PaymentService(
            PaymentRepository payments,
            PaymentInitiationTransaction initiation,
            PaymentFinalizationTransaction finalization,
            Clock clock,
            MeterRegistry registry) {
        this.payments = payments;
        this.initiation = initiation;
        this.finalization = finalization;
        this.clock = clock;
        this.createdCounter = registry.counter("clearledger.payments.created");
        this.duplicateCounter = registry.counter("clearledger.payments.duplicates");
    }

    public PaymentCreationResult create(
            CreatePaymentRequest request, String idempotencyKey, ProcessingFault fault) {
        String normalizedKey = validateKey(idempotencyKey);
        String keyHash = IdempotencyKeyHasher.sha256(normalizedKey);
        String fingerprint = RequestFingerprint.sha256(request.toData());
        var initiated = initiation.initiate(request, keyHash, fingerprint);
        if (initiated.duplicate()) {
            duplicateCounter.increment();
            log.info("Idempotent payment replay paymentId={}", initiated.payment().id());
            return new PaymentCreationResult(initiated.payment(), true);
        }

        createdCounter.increment();
        log.info(
                "Payment initiated paymentId={} riskDecision={}",
                initiated.payment().id(),
                initiated.payment().riskDecision());
        if (fault == ProcessingFault.AFTER_LEDGER_COMMIT) {
            finalization.markForReconciliation(initiated.payment().id());
            throw new SimulatedTimeoutException(initiated.payment().id());
        }
        return new PaymentCreationResult(
                finalization.finalizeDecision(initiated.payment().id()), false);
    }

    public PaymentSnapshot get(UUID id) {
        return payments.findById(id)
                .map(PaymentEntity::snapshot)
                .orElseThrow(() -> new PaymentNotFoundException(id));
    }

    public List<PaymentSnapshot> list(PaymentStatus status, int size) {
        PageRequest limit = PageRequest.of(0, Math.min(Math.max(size, 1), 100));
        List<PaymentEntity> result =
                status == null
                        ? payments.findAllByOrderByCreatedAtDesc(limit)
                        : payments.findByStatusOrderByCreatedAtDesc(status, limit);
        return result.stream().map(PaymentEntity::snapshot).toList();
    }

    public DashboardSummary dashboard() {
        long total = payments.count();
        long approved = payments.countByStatus(PaymentStatus.APPROVED);
        long review = payments.countByStatus(PaymentStatus.REVIEW);
        long rejected = payments.countByStatus(PaymentStatus.REJECTED);
        long pending = payments.countByStatus(PaymentStatus.PENDING);
        double approvalRate = total == 0 ? 0 : (approved * 100.0) / total;
        long todayVolume =
                payments.volumeSince(
                        LocalDate.now(clock)
                                .atStartOfDay()
                                .toInstant(ZoneOffset.UTC));
        return new DashboardSummary(
                total, pending, approved, review, rejected, approvalRate, todayVolume);
    }

    private String validateKey(String key) {
        if (key == null) {
            throw new InvalidIdempotencyKeyException();
        }
        String normalized = key.strip();
        boolean printable = normalized.chars().allMatch(character -> character >= 33 && character <= 126);
        if (normalized.length() < 8 || normalized.length() > 200 || !printable) {
            throw new InvalidIdempotencyKeyException();
        }
        return normalized;
    }

    public record DashboardSummary(
            long totalPayments,
            long pending,
            long approved,
            long review,
            long rejected,
            double approvalRate,
            long volumeTodayMinor) {}
}
