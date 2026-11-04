package vn.lichgiadinh.screentime;

import java.net.URI;

final class ServerAddress {
    private ServerAddress() {}

    static String validate(String input, boolean debug) throws Exception {
        URI uri = new URI(input.trim().replaceAll("/+$", ""));
        boolean usb = debug && "http".equalsIgnoreCase(uri.getScheme())
                && ("localhost".equalsIgnoreCase(uri.getHost()) || "127.0.0.1".equals(uri.getHost()));
        if ((!"https".equalsIgnoreCase(uri.getScheme()) && !usb) || uri.getHost() == null
                || uri.getUserInfo() != null || uri.getQuery() != null || uri.getFragment() != null
                || uri.getPath() == null || !uri.getPath().endsWith("/api/v1")) {
            throw new IllegalArgumentException(debug
                    ? "Dùng HTTPS, hoặc http://localhost:3004/api/v1 khi kiểm thử qua USB. Địa chỉ phải kết thúc bằng /api/v1."
                    : "Địa chỉ phải là HTTPS và kết thúc bằng /api/v1, như địa chỉ hiển thị trên web.");
        }
        return uri.toASCIIString();
    }
}
