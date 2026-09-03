package io.clearledger.console;

import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/** The time windows the console offers, and how each one is bucketed for charting. */
public enum ConsoleRange {
    LAST_24_HOURS("24h", "Last 24 hours", Duration.ofHours(24), Duration.ofHours(2), "HH:mm"),
    LAST_7_DAYS("7d", "Last 7 days", Duration.ofDays(7), Duration.ofDays(1), "EEE"),
    LAST_30_DAYS("30d", "Last 30 days", Duration.ofDays(30), Duration.ofDays(1), "d MMM");

    private final String id;
    private final String label;
    private final Duration window;
    private final Duration bucket;
    private final String pattern;

    ConsoleRange(String id, String label, Duration window, Duration bucket, String pattern) {
        this.id = id;
        this.label = label;
        this.window = window;
        this.bucket = bucket;
        this.pattern = pattern;
    }

    public static ConsoleRange fromId(String candidate) {
        if (candidate == null) {
            return LAST_24_HOURS;
        }
        String normalized = candidate.strip().toLowerCase(Locale.ROOT);
        for (ConsoleRange range : values()) {
            if (range.id.equals(normalized)) {
                return range;
            }
        }
        return LAST_24_HOURS;
    }

    public String id() {
        return id;
    }

    public String label() {
        return label;
    }

    public Duration window() {
        return window;
    }

    /** Start of the current window, snapped down to a whole bucket so buckets are stable. */
    public Instant start(Instant now) {
        return truncate(now.minus(window));
    }

    public Instant truncate(Instant instant) {
        ChronoUnit unit = bucket.toDays() >= 1 ? ChronoUnit.DAYS : ChronoUnit.HOURS;
        Instant floored = instant.truncatedTo(unit);
        if (unit == ChronoUnit.HOURS && bucket.toHours() > 1) {
            long hours = floored.atZone(ZoneOffset.UTC).getHour();
            long offset = hours % bucket.toHours();
            return floored.minus(Duration.ofHours(offset));
        }
        return floored;
    }

    /**
     * Bucket boundaries covering the window, oldest first.
     *
     * <p>The last boundary is the bucket the present moment falls in, which is partial and
     * still filling. Nothing beyond it is emitted: a column that cannot yet contain a
     * payment reads as a drop to zero rather than as the edge of the data.
     */
    public List<Instant> buckets(Instant now) {
        List<Instant> boundaries = new ArrayList<>();
        Instant cursor = start(now);
        while (cursor.isBefore(now)) {
            boundaries.add(cursor);
            cursor = cursor.plus(bucket);
        }
        return boundaries;
    }

    public Duration bucket() {
        return bucket;
    }

    public String bucketPattern() {
        return pattern;
    }
}
