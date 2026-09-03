package io.clearledger.console;

import io.clearledger.payment.PaymentEntity;
import io.clearledger.payment.PaymentStatus;
import io.clearledger.risk.RiskDecision;
import jakarta.persistence.criteria.Predicate;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;

/**
 * The payments table's filter state, translated into a Criteria specification.
 *
 * <p>Filtering runs in the database rather than in the browser, so the row count in the
 * footer is the true count and paging past page one is correct.
 */
public record PaymentQuery(
        String text,
        PaymentStatus status,
        RiskDecision riskDecision,
        String signal,
        Instant since,
        boolean exceptionsOnly,
        String sort,
        Sort.Direction direction) {

    private static final Set<String> SORTABLE =
            Set.of("createdAt", "updatedAt", "amountMinor", "riskScore", "status", "reference");

    /**
     * Only the columns the table actually offers can reach the database. Anything else —
     * including a missing value, or a column the caller invented — falls back to newest
     * first rather than being handed to the query builder.
     */
    public Sort toSort() {
        String property = sort != null && SORTABLE.contains(sort) ? sort : "createdAt";
        return Sort.by(direction == null ? Sort.Direction.DESC : direction, property);
    }

    /**
     * @param counterpartyIds identifiers of counterparties whose name matched the search
     *     text, resolved before the query so a name search can reach a payment that only
     *     stores the counterparty's UUID
     */
    public Specification<PaymentEntity> toSpecification(Set<UUID> counterpartyIds) {
        return (root, criteria, builder) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (status != null) {
                predicates.add(builder.equal(root.get("status"), status));
            }
            if (riskDecision != null) {
                predicates.add(builder.equal(root.get("riskDecision"), riskDecision));
            }
            if (signal != null && !signal.isBlank()) {
                predicates.add(
                        builder.like(
                                root.get("riskSignals"),
                                "%" + signal.strip().toUpperCase(Locale.ROOT) + "%"));
            }
            if (since != null) {
                predicates.add(builder.greaterThanOrEqualTo(root.get("createdAt"), since));
            }
            if (exceptionsOnly) {
                predicates.add(builder.equal(root.get("status"), PaymentStatus.PENDING));
            }
            if (text != null && !text.isBlank()) {
                String pattern = "%" + text.strip().toLowerCase(Locale.ROOT) + "%";
                List<Predicate> matches = new ArrayList<>();
                matches.add(builder.like(builder.lower(root.get("description")), pattern));
                matches.add(builder.like(builder.lower(root.get("reference")), pattern));
                matches.add(builder.like(builder.lower(root.get("currency")), pattern));
                if (!counterpartyIds.isEmpty()) {
                    matches.add(root.get("senderId").in(counterpartyIds));
                    matches.add(root.get("recipientId").in(counterpartyIds));
                }
                predicates.add(builder.or(matches.toArray(Predicate[]::new)));
            }
            return predicates.isEmpty()
                    ? builder.conjunction()
                    : builder.and(predicates.toArray(Predicate[]::new));
        };
    }
}
