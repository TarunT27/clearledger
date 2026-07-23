package io.clearledger.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import io.clearledger.payment.IdempotencyConflictException;
import io.clearledger.payment.InvalidIdempotencyKeyException;
import io.clearledger.payment.PaymentNotFoundException;
import io.clearledger.payment.SimulatedTimeoutException;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.converter.HttpMessageNotReadableException;

@ExtendWith(MockitoExtension.class)
class ApiExceptionHandlerTest {
    private final ApiExceptionHandler handler = new ApiExceptionHandler();
    @Mock HttpServletRequest request;

    @Test
    void mapsKnownDomainErrorsToStableStatusAndCode() {
        assertThat(
                        handler.conflict(new IdempotencyConflictException())
                                .getStatusCode()
                                .value())
                .isEqualTo(409);
        assertThat(
                        handler.notFound(new PaymentNotFoundException(UUID.randomUUID()))
                                .getStatusCode()
                                .value())
                .isEqualTo(404);
        assertThat(
                        handler.unknownScenario(new UnknownScenarioException("x"))
                                .getBody()
                                .error()
                                .code())
                .isEqualTo("SCENARIO_NOT_FOUND");
    }

    @Test
    void timeoutDescribesRequiredReconciliationWithoutClaimingCompletion() {
        var response = handler.timeout(new SimulatedTimeoutException(UUID.randomUUID()));

        assertThat(response.getStatusCode().value()).isEqualTo(504);
        @SuppressWarnings("unchecked")
        Map<String, Object> details =
                (Map<String, Object>) response.getBody().error().details();
        assertThat(details)
                .containsEntry("requiresReconciliation", true);
    }

    @Test
    void malformedAndInvalidRequestsAreBadRequests() {
        assertThat(handler.badRequest(new InvalidIdempotencyKeyException()).getStatusCode().value())
                .isEqualTo(400);
        assertThat(
                        handler.badRequest(
                                        new HttpMessageNotReadableException(
                                                "malformed",
                                                org.mockito.Mockito.mock(
                                                        org.springframework.http.HttpInputMessage.class)))
                                .getBody()
                                .error()
                                .message())
                .isEqualTo("The request body is malformed.");
    }

    @Test
    void unexpectedErrorsDoNotExposeInternalMessage() {
        when(request.getMethod()).thenReturn("GET");
        when(request.getRequestURI()).thenReturn("/api/v1/payments");

        var response = handler.unexpected(new RuntimeException("database secret"), request);

        assertThat(response.getBody().error().message())
                .isEqualTo("An unexpected error occurred.");
    }
}
