package io.clearledger.api;

import io.clearledger.payment.IdempotencyConflictException;
import io.clearledger.payment.InvalidIdempotencyKeyException;
import io.clearledger.payment.PaymentNotFoundException;
import io.clearledger.payment.SimulatedTimeoutException;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingRequestHeaderException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class ApiExceptionHandler {
    private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ApiEnvelope<Void>> validation(MethodArgumentNotValidException exception) {
        List<Map<String, String>> details =
                exception.getBindingResult().getFieldErrors().stream()
                        .map(this::fieldError)
                        .toList();
        return response(
                HttpStatus.BAD_REQUEST,
                "VALIDATION_FAILED",
                "The request contains invalid fields.",
                details);
    }

    @ExceptionHandler({
        HttpMessageNotReadableException.class,
        InvalidIdempotencyKeyException.class
    })
    ResponseEntity<ApiEnvelope<Void>> badRequest(RuntimeException exception) {
        String message =
                exception instanceof InvalidIdempotencyKeyException
                        ? exception.getMessage()
                        : "The request body is malformed.";
        return response(HttpStatus.BAD_REQUEST, "INVALID_REQUEST", message, null);
    }

    @ExceptionHandler(MissingRequestHeaderException.class)
    ResponseEntity<ApiEnvelope<Void>> missingHeader(MissingRequestHeaderException exception) {
        return response(
                HttpStatus.BAD_REQUEST,
                "MISSING_HEADER",
                "Required header " + exception.getHeaderName() + " is missing.",
                null);
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    ResponseEntity<ApiEnvelope<Void>> invalidParameter(
            MethodArgumentTypeMismatchException exception) {
        return response(
                HttpStatus.BAD_REQUEST,
                "INVALID_PARAMETER",
                "Query or path parameter " + exception.getName() + " is invalid.",
                null);
    }

    @ExceptionHandler(IdempotencyConflictException.class)
    ResponseEntity<ApiEnvelope<Void>> conflict(IdempotencyConflictException exception) {
        return response(
                HttpStatus.CONFLICT,
                "IDEMPOTENCY_CONFLICT",
                exception.getMessage(),
                null);
    }

    @ExceptionHandler(PaymentNotFoundException.class)
    ResponseEntity<ApiEnvelope<Void>> notFound(PaymentNotFoundException exception) {
        return response(
                HttpStatus.NOT_FOUND, "PAYMENT_NOT_FOUND", exception.getMessage(), null);
    }

    @ExceptionHandler(UnknownScenarioException.class)
    ResponseEntity<ApiEnvelope<Void>> unknownScenario(UnknownScenarioException exception) {
        return response(
                HttpStatus.NOT_FOUND, "SCENARIO_NOT_FOUND", exception.getMessage(), null);
    }

    @ExceptionHandler(SimulatedTimeoutException.class)
    ResponseEntity<ApiEnvelope<Void>> timeout(SimulatedTimeoutException exception) {
        return response(
                HttpStatus.GATEWAY_TIMEOUT,
                "SIMULATED_TIMEOUT",
                exception.getMessage(),
                Map.of(
                        "paymentId",
                        exception.paymentId(),
                        "duplicateChargeSafe",
                        true,
                        "requiresReconciliation",
                        true));
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<ApiEnvelope<Void>> unexpected(
            Exception exception, HttpServletRequest request) {
        log.error(
                "Unhandled API error method={} path={}",
                request.getMethod(),
                request.getRequestURI(),
                exception);
        return response(
                HttpStatus.INTERNAL_SERVER_ERROR,
                "INTERNAL_ERROR",
                "An unexpected error occurred.",
                null);
    }

    private Map<String, String> fieldError(FieldError error) {
        return Map.of(
                "field",
                error.getField(),
                "message",
                error.getDefaultMessage() == null
                        ? "Invalid value."
                        : error.getDefaultMessage());
    }

    private ResponseEntity<ApiEnvelope<Void>> response(
            HttpStatus status, String code, String message, Object details) {
        return ResponseEntity.status(status)
                .body(ApiEnvelope.failure(code, message, details));
    }
}
