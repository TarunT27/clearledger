package io.clearledger.counterparty;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CounterpartyRepository extends JpaRepository<CounterpartyEntity, UUID> {

    List<CounterpartyEntity> findByRoleOrderByDisplayNameAsc(CounterpartyRole role);

    List<CounterpartyEntity> findByDisplayNameContainingIgnoreCase(String fragment);
}
