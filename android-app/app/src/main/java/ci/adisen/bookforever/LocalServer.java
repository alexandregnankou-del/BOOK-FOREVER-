package ci.adisen.bookforever;

import android.content.res.AssetManager;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Serveur local embarqué.
 *
 * Sert l'interface depuis les ressources de l'application (assets/www) sur
 * http://127.0.0.1:port — l'app s'ouvre donc sans réseau — et relaie les appels
 * /api/* vers le site, en conservant les cookies de session.
 *
 * Aucune dépendance externe : ServerSocket + HttpURLConnection.
 */
public class LocalServer {

    private static final String API_HOST = "book-forever.onrender.com";
    private static final String API_ORIGIN = "https://" + API_HOST;

    private final AssetManager assets;
    private ServerSocket socket;
    private Thread worker;
    private volatile boolean running = false;
    private int port = 0;

    public LocalServer(AssetManager assets) {
        this.assets = assets;
    }

    public int start() throws IOException {
        socket = new ServerSocket(0, 32, InetAddress.getByName("127.0.0.1"));
        port = socket.getLocalPort();
        running = true;
        worker = new Thread(new Runnable() {
            @Override
            public void run() {
                acceptLoop();
            }
        }, "bf-local-http");
        worker.setDaemon(true);
        worker.start();
        return port;
    }

    public int getPort() {
        return port;
    }

    public void stop() {
        running = false;
        try {
            if (socket != null) socket.close();
        } catch (IOException ignored) {
        }
    }

    private void acceptLoop() {
        while (running) {
            Socket client = null;
            try {
                client = socket.accept();
                final Socket current = client;
                new Thread(new Runnable() {
                    @Override
                    public void run() {
                        try {
                            handle(current);
                        } catch (Exception ignored) {
                        } finally {
                            try {
                                current.close();
                            } catch (IOException ignored) {
                            }
                        }
                    }
                }).start();
            } catch (IOException e) {
                if (!running) return;
            }
        }
    }

    private void handle(Socket client) throws IOException {
        InputStream in = client.getInputStream();
        OutputStream out = client.getOutputStream();

        String requestLine = readLine(in);
        if (requestLine == null || requestLine.isEmpty()) return;

        String[] parts = requestLine.split(" ");
        if (parts.length < 2) return;
        String method = parts[0].toUpperCase(Locale.ROOT);
        String target = parts[1];

        List<String[]> headers = new ArrayList<>();
        int contentLength = 0;
        String line;
        while ((line = readLine(in)) != null && !line.isEmpty()) {
            int idx = line.indexOf(':');
            if (idx <= 0) continue;
            String name = line.substring(0, idx).trim();
            String value = line.substring(idx + 1).trim();
            headers.add(new String[]{name, value});
            if (name.equalsIgnoreCase("Content-Length")) {
                try {
                    contentLength = Integer.parseInt(value);
                } catch (NumberFormatException ignored) {
                }
            }
        }

        byte[] body = new byte[0];
        if (contentLength > 0) {
            body = readExactly(in, contentLength);
        }

        if (target.startsWith("/api/")) {
            proxy(method, target, headers, body, out);
        } else {
            serveAsset(method, target, headers, out);
        }
        out.flush();
    }

    /* ---------------- fichiers embarqués ---------------- */

    private void serveAsset(String method, String target, List<String[]> headers, OutputStream out)
            throws IOException {
        String path = target;
        int q = path.indexOf('?');
        if (q >= 0) path = path.substring(0, q);
        if (path.equals("/") || path.isEmpty()) path = "/index.html";
        if (path.contains("..")) path = "/index.html";

        if (path.equals("/sw.js")) {
            // Dans l'app, les fichiers sont déjà locaux : aucun service worker.
            write(out, 200, "OK", "application/javascript; charset=utf-8",
                    "self.addEventListener('install',function(){self.skipWaiting()});".getBytes(StandardCharsets.UTF_8),
                    method);
            return;
        }

        // Téléchargements et galerie : renvoyés au site, qui les sert vraiment.
        if (path.startsWith("/download/") || path.startsWith("/pub/")) {
            String location = API_ORIGIN + target;
            String redirect = "HTTP/1.1 302 Found\r\nLocation: " + location
                    + "\r\nContent-Length: 0\r\nConnection: close\r\n\r\n";
            out.write(redirect.getBytes(StandardCharsets.UTF_8));
            return;
        }

        byte[] data = readAsset("www" + path);
        if (data == null) {
            // Application monopage : toute route inconnue reçoit index.html
            if (path.startsWith("/assets/") || path.startsWith("/icons/")
                    || path.startsWith("/fonts/") || path.startsWith("/audio/")
                    || path.startsWith("/media/")) {
                write(out, 404, "Not Found", "text/plain; charset=utf-8", new byte[0], method);
                return;
            }
            data = readAsset("www/index.html");
            if (data == null) {
                write(out, 500, "Internal Error", "text/plain; charset=utf-8", new byte[0], method);
                return;
            }
            write(out, 200, "OK", "text/html; charset=utf-8", data, method);
            return;
        }
        writeMedia(out, method, path, data, headers);
    }

    /**
     * Réponse d'un fichier embarqué, avec gestion de l'en-tête Range.
     *
     * Indispensable à la vidéo : le lecteur de Chromium demande d'abord
     * « bytes=0- » et compte sur un 206 pour pouvoir ensuite se déplacer dans
     * le fichier. Sans Range, le clip se bloque ou refuse de démarrer.
     */
    private void writeMedia(OutputStream out, String method, String path, byte[] data, List<String[]> headers)
            throws IOException {
        String type = contentType(path);
        String range = headerValue(headers, "Range");

        if (range != null) {
            long[] span = parseRange(range, data.length);
            if (span == null) {
                String refusal = "HTTP/1.1 416 Range Not Satisfiable\r\nContent-Range: bytes */"
                        + data.length + "\r\nContent-Length: 0\r\nConnection: close\r\n\r\n";
                out.write(refusal.getBytes(StandardCharsets.UTF_8));
                return;
            }
            int start = (int) span[0];
            int length = (int) (span[1] - span[0] + 1);
            StringBuilder head = new StringBuilder();
            head.append("HTTP/1.1 206 Partial Content\r\n");
            head.append("Content-Type: ").append(type).append("\r\n");
            head.append("Content-Length: ").append(length).append("\r\n");
            head.append("Content-Range: bytes ").append(start).append('-').append(span[1])
                    .append('/').append(data.length).append("\r\n");
            head.append("Accept-Ranges: bytes\r\n");
            head.append("Cache-Control: no-store\r\n");
            head.append("Connection: close\r\n\r\n");
            out.write(head.toString().getBytes(StandardCharsets.UTF_8));
            if (!"HEAD".equals(method)) out.write(data, start, length);
            return;
        }

        StringBuilder head = new StringBuilder();
        head.append("HTTP/1.1 200 OK\r\n");
        head.append("Content-Type: ").append(type).append("\r\n");
        head.append("Content-Length: ").append(data.length).append("\r\n");
        head.append("Accept-Ranges: bytes\r\n");
        head.append("Cache-Control: no-store\r\n");
        head.append("Connection: close\r\n\r\n");
        out.write(head.toString().getBytes(StandardCharsets.UTF_8));
        if (!"HEAD".equals(method)) out.write(data);
    }

    private static String headerValue(List<String[]> headers, String wanted) {
        for (String[] header : headers) {
            if (header[0].equalsIgnoreCase(wanted)) return header[1];
        }
        return null;
    }

    /** « bytes=0- » , « bytes=100-999 » , « bytes=-500 » → {début, fin} ; null si invalide. */
    private static long[] parseRange(String value, int total) {
        if (total <= 0 || !value.startsWith("bytes=")) return null;
        String spec = value.substring(6).split(",")[0].trim();
        int dash = spec.indexOf('-');
        if (dash < 0) return null;
        String startText = spec.substring(0, dash).trim();
        String endText = spec.substring(dash + 1).trim();
        try {
            if (startText.isEmpty()) {
                int suffix = Integer.parseInt(endText);
                if (suffix <= 0) return null;
                int start = Math.max(0, total - suffix);
                return new long[]{start, total - 1};
            }
            long start = Long.parseLong(startText);
            long end = endText.isEmpty() ? total - 1 : Math.min(Long.parseLong(endText), total - 1);
            if (start >= total || start > end) return null;
            return new long[]{start, end};
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private byte[] readAsset(String path) {
        InputStream stream = null;
        try {
            stream = assets.open(path);
            ByteArrayOutputStream buffer = new ByteArrayOutputStream();
            byte[] chunk = new byte[16384];
            int read;
            while ((read = stream.read(chunk)) != -1) buffer.write(chunk, 0, read);
            return buffer.toByteArray();
        } catch (IOException e) {
            return null;
        } finally {
            if (stream != null) try { stream.close(); } catch (IOException ignored) { }
        }
    }

    private String contentType(String path) {
        String p = path.toLowerCase(Locale.ROOT);
        if (p.endsWith(".html")) return "text/html; charset=utf-8";
        if (p.endsWith(".css")) return "text/css; charset=utf-8";
        if (p.endsWith(".js")) return "application/javascript; charset=utf-8";
        if (p.endsWith(".json") || p.endsWith(".webmanifest")) return "application/json; charset=utf-8";
        if (p.endsWith(".svg")) return "image/svg+xml";
        if (p.endsWith(".png")) return "image/png";
        if (p.endsWith(".jpg") || p.endsWith(".jpeg")) return "image/jpeg";
        if (p.endsWith(".webp")) return "image/webp";
        if (p.endsWith(".woff2")) return "font/woff2";
        if (p.endsWith(".woff")) return "font/woff";
        if (p.endsWith(".mp3")) return "audio/mpeg";
        if (p.endsWith(".mp4") || p.endsWith(".m4v")) return "video/mp4";
        if (p.endsWith(".webm")) return "video/webm";
        if (p.endsWith(".ico")) return "image/x-icon";
        return "application/octet-stream";
    }

    /* ---------------- relais vers le site ---------------- */

    private void proxy(String method, String target, List<String[]> headers, byte[] body, OutputStream out)
            throws IOException {
        HttpURLConnection conn = null;
        try {
            URL url = new URL(API_ORIGIN + target);
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod(method);
            conn.setConnectTimeout(15000);
            conn.setReadTimeout(25000);
            conn.setInstanceFollowRedirects(true);
            conn.setRequestProperty("Host", API_HOST);
            conn.setRequestProperty("Accept-Encoding", "identity");

            StringBuilder cookie = new StringBuilder();
            for (String[] header : headers) {
                String name = header[0];
                String value = header[1];
                if (name.equalsIgnoreCase("Cookie")) {
                    if (cookie.length() > 0) cookie.append("; ");
                    cookie.append(value);
                } else if (name.equalsIgnoreCase("Accept")
                        || name.equalsIgnoreCase("Content-Type")
                        || name.equalsIgnoreCase("User-Agent")
                        || name.equalsIgnoreCase("Authorization")) {
                    conn.setRequestProperty(name, value);
                }
            }
            if (cookie.length() > 0) conn.setRequestProperty("Cookie", cookie.toString());

            boolean sendsBody = body.length > 0
                    && ("POST".equals(method) || "PUT".equals(method) || "PATCH".equals(method) || "DELETE".equals(method));
            if (sendsBody) {
                conn.setDoOutput(true);
                OutputStream requestBody = conn.getOutputStream();
                requestBody.write(body);
                requestBody.flush();
                requestBody.close();
            }

            int status = conn.getResponseCode();
            if (status <= 0) status = 502;

            InputStream source;
            try {
                source = conn.getInputStream();
            } catch (IOException e) {
                source = conn.getErrorStream();
            }
            byte[] payload = source == null ? new byte[0] : readAll(source);
            String type = conn.getContentType() == null ? "application/json; charset=utf-8" : conn.getContentType();

            StringBuilder extra = new StringBuilder();
            for (java.util.Map.Entry<String, List<String>> entry : conn.getHeaderFields().entrySet()) {
                String name = entry.getKey();
                if (name == null) continue;
                if (!name.equalsIgnoreCase("Set-Cookie")) continue;
                for (String value : entry.getValue()) {
                    extra.append("Set-Cookie: ").append(sanitizeCookie(value)).append("\r\n");
                }
            }

            writeWithExtra(out, status, messageFor(status), type, payload,
                    "GET".equals(method) || "HEAD".equals(method) ? method : "GET", extra.toString());
        } catch (Exception e) {
            byte[] error = "{\"error\":\"reseau indisponible\"}".getBytes(StandardCharsets.UTF_8);
            write(out, 503, "Service Unavailable", "application/json; charset=utf-8", error, "GET");
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    /** Retire Domain et Secure : le cookie doit rester valable sur 127.0.0.1. */
    private String sanitizeCookie(String value) {
        String[] bits = value.split(";");
        StringBuilder result = new StringBuilder(bits[0]);
        for (int i = 1; i < bits.length; i++) {
            String bit = bits[i].trim();
            String lower = bit.toLowerCase(Locale.ROOT);
            if (lower.startsWith("domain=") || lower.equals("secure")) continue;
            result.append("; ").append(bit);
        }
        return result.toString();
    }

    /* ---------------- utilitaire HTTP ---------------- */

    private void write(OutputStream out, int status, String reason, String type, byte[] body, String method)
            throws IOException {
        writeWithExtra(out, status, reason, type, body, method, "");
    }

    private void writeWithExtra(OutputStream out, int status, String reason, String type, byte[] body,
                                String method, String extraHeaders) throws IOException {
        StringBuilder headers = new StringBuilder();
        headers.append("HTTP/1.1 ").append(status).append(' ').append(reason).append("\r\n");
        headers.append("Content-Type: ").append(type).append("\r\n");
        headers.append("Content-Length: ").append(body.length).append("\r\n");
        headers.append("Cache-Control: no-store\r\n");
        headers.append("Connection: close\r\n");
        headers.append(extraHeaders);
        headers.append("\r\n");
        out.write(headers.toString().getBytes(StandardCharsets.UTF_8));
        if (!"HEAD".equals(method)) out.write(body);
    }

    private String messageFor(int status) {
        switch (status) {
            case 200: return "OK";
            case 201: return "Created";
            case 204: return "No Content";
            case 400: return "Bad Request";
            case 401: return "Unauthorized";
            case 402: return "Payment Required";
            case 403: return "Forbidden";
            case 404: return "Not Found";
            case 409: return "Conflict";
            case 500: return "Internal Server Error";
            default: return "Response";
        }
    }

    private static String readLine(InputStream in) throws IOException {
        ByteArrayOutputStream buffer = new ByteArrayOutputStream();
        int c;
        while ((c = in.read()) != -1) {
            if (c == '\n') break;
            if (c != '\r') buffer.write(c);
        }
        if (c == -1 && buffer.size() == 0) return null;
        return buffer.toString("UTF-8");
    }

    private static byte[] readExactly(InputStream in, int length) throws IOException {
        byte[] data = new byte[length];
        int offset = 0;
        while (offset < length) {
            int read = in.read(data, offset, length - offset);
            if (read == -1) break;
            offset += read;
        }
        return data;
    }

    private static byte[] readAll(InputStream in) throws IOException {
        ByteArrayOutputStream buffer = new ByteArrayOutputStream();
        byte[] chunk = new byte[16384];
        int read;
        while ((read = in.read(chunk)) != -1) buffer.write(chunk, 0, read);
        return buffer.toByteArray();
    }
}
