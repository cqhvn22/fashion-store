package com.fashion.order;

import com.fashion.common.Api;
import com.fashion.inventory.grpc.CheckoutRequest;
import com.fashion.inventory.grpc.InventoryServiceGrpc.InventoryServiceBlockingStub;
import com.fashion.inventory.grpc.ItemSnapshot;
import com.fashion.inventory.grpc.ReservationItem;
import com.fashion.inventory.grpc.ReserveRequest;
import io.grpc.Metadata;
import io.grpc.Status;
import io.grpc.StatusRuntimeException;
import io.grpc.stub.MetadataUtils;
import io.quarkus.grpc.GrpcClient;
import jakarta.enterprise.context.ApplicationScoped;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import org.eclipse.microprofile.config.inject.ConfigProperty;

@ApplicationScoped
public class CatalogClient {
    private static final Metadata.Key<String> KEY =
            Metadata.Key.of("x-internal-key", Metadata.ASCII_STRING_MARSHALLER);

    @GrpcClient("inventory") InventoryServiceBlockingStub inventory;
    @ConfigProperty(name = "internal.api.key") String internalKey;

    public List<ItemSnapshot> reserve(UUID checkoutId, List<OrderResource.Item> items, Instant expiresAt) {
        ReserveRequest.Builder request = ReserveRequest.newBuilder()
                .setCheckoutId(checkoutId.toString())
                .setExpiresAtEpochMillis(expiresAt.toEpochMilli());
        for (OrderResource.Item item : items) {
            request.addItems(ReservationItem.newBuilder()
                    .setVariantId(item.variantId().toString())
                    .setQuantity(item.quantity()).build());
        }
        try {
            return stub().reserve(request.build()).getSnapshotsList();
        } catch (StatusRuntimeException error) {
            throw apiError(error);
        }
    }

    public void commit(UUID checkoutId) { finish(checkoutId, true); }

    public void release(UUID checkoutId) { finish(checkoutId, false); }

    private void finish(UUID checkoutId, boolean commit) {
        try {
            CheckoutRequest request = CheckoutRequest.newBuilder()
                    .setCheckoutId(checkoutId.toString()).build();
            if (commit) stub().commit(request);
            else stub().release(request);
        } catch (StatusRuntimeException error) {
            throw apiError(error);
        }
    }

    private InventoryServiceBlockingStub stub() {
        Metadata headers = new Metadata();
        headers.put(KEY, internalKey);
        return inventory.withInterceptors(MetadataUtils.newAttachHeadersInterceptor(headers))
                .withDeadlineAfter(10, TimeUnit.SECONDS);
    }

    private RuntimeException apiError(StatusRuntimeException error) {
        Status.Code status = error.getStatus().getCode();
        String description = error.getStatus().getDescription();
        String[] details = description == null ? new String[0] : description.split("\\|", 2);
        String code = details.length == 2 ? details[0] : "CATALOG_UNAVAILABLE";
        String message = details.length == 2 ? details[1] : "Không thể kết nối Catalog";
        int httpStatus = switch (status) {
            case INVALID_ARGUMENT -> 400;
            case FAILED_PRECONDITION, RESOURCE_EXHAUSTED -> 409;
            case NOT_FOUND -> 404;
            default -> 502;
        };
        return Api.error(httpStatus, code, message);
    }
}
