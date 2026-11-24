package com.fashion.catalog;

import io.grpc.Metadata;
import io.grpc.ServerCall;
import io.grpc.ServerCallHandler;
import io.grpc.ServerInterceptor;
import io.grpc.Status;
import jakarta.enterprise.context.ApplicationScoped;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import org.eclipse.microprofile.config.inject.ConfigProperty;

@ApplicationScoped
public class InventoryKeyInterceptor implements ServerInterceptor {
    static final Metadata.Key<String> KEY =
            Metadata.Key.of("x-internal-key", Metadata.ASCII_STRING_MARSHALLER);

    @ConfigProperty(name = "internal.api.key") String internalKey;

    @Override
    public <ReqT, RespT> ServerCall.Listener<ReqT> interceptCall(ServerCall<ReqT, RespT> call,
            Metadata headers, ServerCallHandler<ReqT, RespT> next) {
        String supplied = headers.get(KEY);
        if (supplied == null || !MessageDigest.isEqual(
                supplied.getBytes(StandardCharsets.UTF_8),
                internalKey.getBytes(StandardCharsets.UTF_8))) {
            call.close(Status.PERMISSION_DENIED.withDescription("Invalid internal key"), new Metadata());
            return new ServerCall.Listener<>() {};
        }
        return next.startCall(call, headers);
    }
}
