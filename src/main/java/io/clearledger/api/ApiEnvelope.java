package io.clearledger.api;

public record ApiEnvelope<T>(boolean success, T data, ApiError error, Object meta) {
    public static <T> ApiEnvelope<T> success(T data) {
        return new ApiEnvelope<>(true, data, null, null);
    }

    public static <T> ApiEnvelope<T> success(T data, Object meta) {
        return new ApiEnvelope<>(true, data, null, meta);
    }

    public static ApiEnvelope<Void> failure(String code, String message, Object details) {
        return new ApiEnvelope<>(false, null, new ApiError(code, message, details), null);
    }

    public record ApiError(String code, String message, Object details) {}
}
