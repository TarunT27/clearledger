package io.clearledger.audit;

import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AuditEventRepository extends JpaRepository<AuditEventEntity, UUID> {

    List<AuditEventEntity> findByPaymentIdOrderByCreatedAtAsc(UUID paymentId);

    List<AuditEventEntity> findByPaymentIdInOrderByCreatedAtAsc(List<UUID> paymentIds);

    @Query(
            """
            select event from AuditEventEntity event
             where (:eventType is null or event.eventType = :eventType)
               and (:query is null
                    or lower(event.detail) like :query
                    or lower(event.actor) like :query
                    or lower(event.eventType) like :query
                    or str(event.paymentId) like :query)
             order by event.createdAt desc
            """)
    Page<AuditEventEntity> search(
            @Param("eventType") String eventType,
            @Param("query") String query,
            Pageable pageable);

    @Query("select event.eventType, count(event) from AuditEventEntity event group by event.eventType")
    List<Object[]> countByEventType();
}
