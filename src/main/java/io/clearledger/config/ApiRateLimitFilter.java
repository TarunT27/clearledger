package io.clearledger.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 2)
public class ApiRateLimitFilter extends OncePerRequestFilter {
    private final ConcurrentHashMap<String, Window> windows = new ConcurrentHashMap<>();
    private final int limit;
    private final Clock clock;

    public ApiRateLimitFilter(
            @Value("${clearledger.api.rate-limit-per-minute:300}") int limit,
            Clock clock) {
        this.limit = limit;
        this.clock = clock;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getRequestURI().startsWith("/api/");
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain)
            throws ServletException, IOException {
        Instant now = clock.instant();
        if (windows.size() > 10_000) {
            windows.entrySet().removeIf(
                    entry -> now.isAfter(entry.getValue().startedAt().plusSeconds(120)));
        }
        Window current =
                windows.compute(
                        request.getRemoteAddr(),
                        (address, previous) ->
                                previous == null || now.isAfter(previous.startedAt().plusSeconds(60))
                                        ? new Window(now, 1)
                                        : new Window(previous.startedAt(), previous.count() + 1));
        if (current.count() > limit) {
            response.setStatus(429);
            response.setHeader("Retry-After", "60");
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            byte[] body =
                    """
                    {"success":false,"data":null,"error":{"code":"RATE_LIMITED","message":"Too many requests. Retry shortly.","details":null},"meta":null}
                    """
                            .strip()
                            .getBytes(StandardCharsets.UTF_8);
            response.setContentLength(body.length);
            response.getOutputStream().write(body);
            return;
        }
        filterChain.doFilter(request, response);
    }

    private record Window(Instant startedAt, int count) {}
}
