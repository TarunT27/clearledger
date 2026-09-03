package io.clearledger.payment;

import io.clearledger.risk.RiskDecision;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PaymentRepository
        extends JpaRepository<PaymentEntity, UUID>,
                JpaSpecificationExecutor<PaymentEntity> {

    Optional<PaymentEntity> findBySenderIdAndIdempotencyKeyHash(UUID senderId, String keyHash);

    List<PaymentEntity> findByStatusOrderByCreatedAtAsc(PaymentStatus status);

    @Query(
            value =
                    """
                    select *
                      from payments
                     where status = 'PENDING'
                       and (reconciliation_required = true or created_at <= :staleBefore)
                     order by created_at
                     limit 100
                       for update skip locked
                    """,
            nativeQuery = true)
    List<PaymentEntity> findPendingForReconciliation(@Param("staleBefore") Instant staleBefore);

    List<PaymentEntity> findAllByOrderByCreatedAtDesc(Pageable pageable);

    List<PaymentEntity> findByStatusOrderByCreatedAtDesc(PaymentStatus status, Pageable pageable);

    long countBySenderIdAndCreatedAtAfter(UUID senderId, Instant since);

    boolean existsBySenderIdAndRecipientIdAndStatus(
            UUID senderId, UUID recipientId, PaymentStatus status);

    @Query("""
            select coalesce(sum(p.amountMinor), 0)
              from PaymentEntity p
             where p.senderId = :senderId
               and p.createdAt >= :since
               and p.riskDecision = :decision
            """)
    long outgoingAmountSince(
            @Param("senderId") UUID senderId,
            @Param("since") Instant since,
            @Param("decision") RiskDecision decision);

    long countByStatus(PaymentStatus status);

    @Query("select coalesce(sum(p.amountMinor), 0) from PaymentEntity p where p.createdAt >= :since")
    long volumeSince(@Param("since") Instant since);

    @Query(
            """
            select new io.clearledger.payment.PaymentPulse(
                    p.createdAt, p.status, p.riskDecision, p.amountMinor, p.riskSignals)
              from PaymentEntity p
             where p.createdAt >= :from
               and p.createdAt < :to
             order by p.createdAt
            """)
    List<PaymentPulse> pulseBetween(@Param("from") Instant from, @Param("to") Instant to);

    @Query("select coalesce(avg(p.riskScore), 0) from PaymentEntity p where p.createdAt >= :since")
    double averageRiskScoreSince(@Param("since") Instant since);

    Optional<PaymentEntity> findByReference(String reference);
}
