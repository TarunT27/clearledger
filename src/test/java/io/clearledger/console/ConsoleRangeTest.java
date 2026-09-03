package io.clearledger.console;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;

class ConsoleRangeTest {

    private static final Instant NOW = Instant.parse("2026-09-03T15:47:11Z");

    @Test
    void unknownAndMissingRangeIdsFallBackToTheShortestWindow() {
        assertThat(ConsoleRange.fromId(null)).isEqualTo(ConsoleRange.LAST_24_HOURS);
        assertThat(ConsoleRange.fromId("nonsense")).isEqualTo(ConsoleRange.LAST_24_HOURS);
        assertThat(ConsoleRange.fromId(" 7D ")).isEqualTo(ConsoleRange.LAST_7_DAYS);
        assertThat(ConsoleRange.fromId("30d")).isEqualTo(ConsoleRange.LAST_30_DAYS);
    }

    @Test
    void twoHourBucketsSnapDownToAnEvenHourSoColumnsStayStable() {
        ConsoleRange range = ConsoleRange.LAST_24_HOURS;

        assertThat(range.truncate(Instant.parse("2026-09-03T15:47:11Z")))
                .isEqualTo(Instant.parse("2026-09-03T14:00:00Z"));
        assertThat(range.truncate(Instant.parse("2026-09-03T14:00:00Z")))
                .isEqualTo(Instant.parse("2026-09-03T14:00:00Z"));
        assertThat(range.start(NOW)).isEqualTo(Instant.parse("2026-09-02T14:00:00Z"));
    }

    @Test
    void dailyBucketsSnapToMidnight() {
        assertThat(ConsoleRange.LAST_7_DAYS.truncate(NOW))
                .isEqualTo(Instant.parse("2026-09-03T00:00:00Z"));
        assertThat(ConsoleRange.LAST_7_DAYS.start(NOW))
                .isEqualTo(Instant.parse("2026-08-27T00:00:00Z"));
    }

    @Test
    void bucketsCoverTheWholeWindowIncludingThePartialCurrentOne() {
        List<Instant> daily = ConsoleRange.LAST_7_DAYS.buckets(NOW);

        assertThat(daily).hasSize(8);
        assertThat(daily).allSatisfy(boundary -> assertThat(boundary).isBefore(NOW));
        assertThat(daily.get(0)).isEqualTo(Instant.parse("2026-08-27T00:00:00Z"));
        assertThat(daily.get(daily.size() - 1)).isEqualTo(Instant.parse("2026-09-03T00:00:00Z"));
        assertThat(daily).isSorted();
    }

    @Test
    void everyBucketBoundaryIsItsOwnTruncation() {
        for (ConsoleRange range : ConsoleRange.values()) {
            for (Instant boundary : range.buckets(NOW)) {
                assertThat(range.truncate(boundary))
                        .as("boundary %s of %s", boundary, range.id())
                        .isEqualTo(boundary);
            }
        }
    }

    @Test
    void bucketCountMatchesTheWindowDividedByTheBucketSize() {
        assertThat(ConsoleRange.LAST_30_DAYS.window()).isEqualTo(Duration.ofDays(30));
        assertThat(ConsoleRange.LAST_30_DAYS.buckets(NOW)).hasSize(31);
        assertThat(ConsoleRange.LAST_24_HOURS.buckets(NOW)).hasSize(13);
    }
}
