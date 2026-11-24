package com.fashion.catalog;

import com.fashion.inventory.grpc.CheckoutRequest;
import com.fashion.inventory.grpc.CheckoutResponse;
import com.fashion.inventory.grpc.InventoryService;
import com.fashion.inventory.grpc.ItemSnapshot;
import com.fashion.inventory.grpc.ReserveRequest;
import com.fashion.inventory.grpc.ReserveResponse;
import io.grpc.Status;
import io.quarkus.grpc.GrpcService;
import io.quarkus.grpc.RegisterInterceptor;
import io.smallrye.common.annotation.Blocking;
import io.smallrye.mutiny.Uni;
import jakarta.inject.Inject;
import jakarta.ws.rs.WebApplicationException;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.jboss.logging.Logger;

@GrpcService
@RegisterInterceptor(InventoryKeyInterceptor.class)
public class InventoryGrpcService implements InventoryService {
    private static final Logger LOG = Logger.getLogger(InventoryGrpcService.class);
    @Inject ReservationResource reservations;

    @Override
    @Blocking
    public Uni<ReserveResponse> reserve(ReserveRequest request) {
        return Uni.createFrom().item(() -> {
            try {
                List<ReservationResource.Item> items = request.getItemsList().stream()
                        .map(item -> new ReservationResource.Item(
                                UUID.fromString(item.getVariantId()), item.getQuantity()))
                        .toList();
                List<Map<String, Object>> snapshots = reservations.reserve(new ReservationResource.Reserve(
                        UUID.fromString(request.getCheckoutId()), items,
                        Instant.ofEpochMilli(request.getExpiresAtEpochMillis())));
                ReserveResponse.Builder response = ReserveResponse.newBuilder();
                for (Map<String, Object> item : snapshots) {
                    response.addSnapshots(ItemSnapshot.newBuilder()
                            .setVariantId(item.get("variantId").toString())
                            .setProductId(item.get("productId").toString())
                            .setProductName(string(item.get("productName")))
                            .setProductSlug(string(item.get("productSlug")))
                            .setSku(string(item.get("sku")))
                            .setSize(string(item.get("size")))
                            .setColor(string(item.get("color")))
                            .setImageUrl(string(item.get("imageUrl")))
                            .setPrice(((Number) item.get("price")).longValue())
                            .setQuantity(((Number) item.get("quantity")).intValue())
                            .build());
                }
                return response.build();
            } catch (RuntimeException error) {
                throw grpcError(error);
            }
        });
    }

    @Override
    @Blocking
    public Uni<CheckoutResponse> commit(CheckoutRequest request) {
        return Uni.createFrom().item(() -> {
            try {
                UUID checkoutId = UUID.fromString(request.getCheckoutId());
                reservations.commit(checkoutId);
                return CheckoutResponse.newBuilder()
                        .setCheckoutId(checkoutId.toString()).setStatus("COMMITTED").build();
            } catch (RuntimeException error) {
                throw grpcError(error);
            }
        });
    }

    @Override
    @Blocking
    public Uni<CheckoutResponse> release(CheckoutRequest request) {
        return Uni.createFrom().item(() -> {
            try {
                UUID checkoutId = UUID.fromString(request.getCheckoutId());
                reservations.release(checkoutId);
                return CheckoutResponse.newBuilder()
                        .setCheckoutId(checkoutId.toString()).setStatus("RELEASED").build();
            } catch (RuntimeException error) {
                throw grpcError(error);
            }
        });
    }

    private String string(Object value) { return value == null ? "" : value.toString(); }

    private RuntimeException grpcError(RuntimeException error) {
        if (error instanceof WebApplicationException web) {
            int httpStatus = web.getResponse().getStatus();
            @SuppressWarnings("unchecked")
            Map<String, Object> body = web.getResponse().getEntity() instanceof Map<?, ?> map
                    ? (Map<String, Object>) map : Map.of();
            String code = String.valueOf(body.getOrDefault("code", "CATALOG_ERROR"));
            String message = String.valueOf(body.getOrDefault("message", "Catalog request failed"));
            Status status = switch (httpStatus) {
                case 400 -> Status.INVALID_ARGUMENT;
                case 404 -> Status.NOT_FOUND;
                case 409 -> "OUT_OF_STOCK".equals(code)
                        ? Status.RESOURCE_EXHAUSTED : Status.FAILED_PRECONDITION;
                default -> Status.INTERNAL;
            };
            return status.withDescription(code + "|" + message).asRuntimeException();
        }
        if (error instanceof IllegalArgumentException) {
            return Status.INVALID_ARGUMENT.withDescription("INVALID_INPUT|Invalid UUID or timestamp")
                    .asRuntimeException();
        }
        LOG.warn("Inventory gRPC operation failed", error);
        return Status.INTERNAL.withDescription("CATALOG_ERROR|Inventory operation failed")
                .asRuntimeException();
    }
}
