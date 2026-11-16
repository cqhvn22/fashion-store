package com.fashion.catalog;

import com.fashion.common.Api;
import jakarta.annotation.security.RolesAllowed;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import java.util.UUID;
import org.eclipse.microprofile.config.inject.ConfigProperty;

@jakarta.ws.rs.Path("/api/v1")
public class MediaResource {
    private static final int MAX_SIZE = 5 * 1024 * 1024;
    @ConfigProperty(name = "catalog.media.directory", defaultValue = "./uploads") String directory;

    @POST @jakarta.ws.rs.Path("/admin/media")
    @RolesAllowed("ADMIN")
    @Consumes({"image/jpeg", "image/png", "image/webp"})
    @Produces(MediaType.APPLICATION_JSON)
    public Map<String, Object> upload(InputStream stream, @HeaderParam("Content-Type") String contentType) throws IOException {
        byte[] bytes = stream.readNBytes(MAX_SIZE + 1);
        Api.require(bytes.length > 0 && bytes.length <= MAX_SIZE, 400,
                "INVALID_IMAGE", "Ảnh phải có dung lượng tối đa 5 MB");
        String extension = switch (contentType == null ? "" : contentType.toLowerCase()) {
            case "image/jpeg" -> isJpeg(bytes) ? ".jpg" : null;
            case "image/png" -> isPng(bytes) ? ".png" : null;
            case "image/webp" -> isWebp(bytes) ? ".webp" : null;
            default -> null;
        };
        Api.require(extension != null, 400, "INVALID_IMAGE", "Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP hợp lệ");
        Path root = Path.of(directory).toAbsolutePath().normalize();
        Files.createDirectories(root);
        String filename = UUID.randomUUID() + extension;
        Files.write(root.resolve(filename), bytes);
        return Api.ok(Map.of("url", "/api/v1/media/" + filename));
    }

    @POST @jakarta.ws.rs.Path("/reviews/media")
    @RolesAllowed({"USER", "ADMIN"})
    @Consumes({"image/jpeg", "image/png", "image/webp"})
    @Produces(MediaType.APPLICATION_JSON)
    public Map<String, Object> uploadReview(InputStream stream, @HeaderParam("Content-Type") String contentType) throws IOException {
        return upload(stream, contentType);
    }

    @GET @jakarta.ws.rs.Path("/media/{filename}")
    public Response get(@PathParam("filename") String filename) throws IOException {
        Api.require(filename.matches("[0-9a-f-]{36}\\.(jpg|png|webp)"), 404,
                "NOT_FOUND", "Không tìm thấy ảnh");
        Path file = Path.of(directory).toAbsolutePath().normalize().resolve(filename);
        Api.require(Files.isRegularFile(file), 404, "NOT_FOUND", "Không tìm thấy ảnh");
        String type = filename.endsWith(".png") ? "image/png" : filename.endsWith(".webp") ? "image/webp" : "image/jpeg";
        return Response.ok(Files.readAllBytes(file), type).header("Cache-Control", "public, max-age=31536000, immutable").build();
    }

    private static boolean isJpeg(byte[] b) { return b.length > 3 && (b[0] & 255) == 255 && (b[1] & 255) == 216 && (b[2] & 255) == 255; }
    private static boolean isPng(byte[] b) { return b.length > 8 && (b[0] & 255) == 137 && b[1] == 80 && b[2] == 78 && b[3] == 71; }
    private static boolean isWebp(byte[] b) { return b.length > 12 && new String(b, 0, 4).equals("RIFF") && new String(b, 8, 4).equals("WEBP"); }
}
