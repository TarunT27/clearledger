package io.clearledger.console;

import java.util.List;
import org.springframework.data.domain.Page;

/** A page of console rows plus the counts the table footer needs. */
public record ConsolePage<T>(
        List<T> items,
        int page,
        int size,
        long totalItems,
        int totalPages,
        boolean hasNext,
        boolean hasPrevious) {

    public ConsolePage {
        items = List.copyOf(items);
    }

    public static <S, T> ConsolePage<T> of(Page<S> source, List<T> items) {
        return new ConsolePage<>(
                items,
                source.getNumber(),
                source.getSize(),
                source.getTotalElements(),
                source.getTotalPages(),
                source.hasNext(),
                source.hasPrevious());
    }
}
