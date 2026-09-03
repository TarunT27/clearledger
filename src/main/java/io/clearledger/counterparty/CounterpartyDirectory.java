package io.clearledger.counterparty;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Read-side lookup that turns the ledger's counterparty UUIDs into names.
 *
 * <p>The table is small reference data, so a request-scoped bulk load is cheaper and far
 * simpler than a join on every console query, and it keeps the payment aggregate free of
 * a foreign key it does not need in order to stay correct.
 */
@Service
public class CounterpartyDirectory {
    private final CounterpartyRepository counterparties;

    public CounterpartyDirectory(CounterpartyRepository counterparties) {
        this.counterparties = counterparties;
    }

    @Transactional(readOnly = true)
    public Map<UUID, CounterpartySnapshot> load() {
        Map<UUID, CounterpartySnapshot> directory = new HashMap<>();
        for (CounterpartyEntity entity : counterparties.findAll()) {
            directory.put(entity.getId(), entity.snapshot());
        }
        return directory;
    }

    @Transactional(readOnly = true)
    public List<CounterpartySnapshot> byRole(CounterpartyRole role) {
        return counterparties.findByRoleOrderByDisplayNameAsc(role).stream()
                .map(CounterpartyEntity::snapshot)
                .toList();
    }

    @Transactional(readOnly = true)
    public Set<UUID> idsMatching(String fragment) {
        return counterparties.findByDisplayNameContainingIgnoreCase(fragment).stream()
                .map(CounterpartyEntity::getId)
                .collect(Collectors.toSet());
    }

    public static CounterpartySnapshot resolve(
            Map<UUID, CounterpartySnapshot> directory, UUID id) {
        CounterpartySnapshot found = directory.get(id);
        return found == null ? CounterpartySnapshot.unknown(id) : found;
    }
}
