package vn.lichgiadinh.screentime;

import android.app.AppOpsManager;
import android.app.usage.UsageEvents;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.pm.ApplicationInfo;
import android.os.Process;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.IOException;
import java.io.InputStream;
import java.io.ByteArrayOutputStream;
import java.net.URI;
import java.net.HttpURLConnection;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

final class Collector {
    static final Object LOCK = new Object();
    private final Context context;
    private final PrivateStore store;
    Collector(Context context) { this.context = context.getApplicationContext(); store = new PrivateStore(this.context); }

    boolean hasPermission() {
        AppOpsManager manager = context.getSystemService(AppOpsManager.class);
        return manager.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.getPackageName()) == AppOpsManager.MODE_ALLOWED;
    }

    static final class HttpFailure extends IOException {
        final int status;
        HttpFailure(int status, String message) { super(message); this.status = status; }
    }

    static String validServer(String input) throws Exception {
        return ServerAddress.validate(input, BuildConfig.DEBUG);
    }

    JSONObject request(String server, String method, String path, String token, JSONObject body) throws Exception {
        HttpURLConnection conn = (HttpURLConnection) new URI(server + "/screen-time/collector/" + path).toURL().openConnection();
        conn.setInstanceFollowRedirects(false); conn.setConnectTimeout(15000); conn.setReadTimeout(20000);
        conn.setRequestMethod(method); conn.setRequestProperty("Accept", "application/json");
        if (!token.isEmpty()) conn.setRequestProperty("Authorization", "Bearer " + token);
        try {
            if (body != null) {
                conn.setDoOutput(true); conn.setRequestProperty("Content-Type", "application/json");
                byte[] payload = body.toString().getBytes(StandardCharsets.UTF_8);
                conn.setFixedLengthStreamingMode(payload.length);
                try (var output = conn.getOutputStream()) { output.write(payload); }
            }
            int status = conn.getResponseCode();
            InputStream input = status >= 400 ? conn.getErrorStream() : conn.getInputStream();
            String text = "";
            if (input != null) try (input; var output = new ByteArrayOutputStream()) {
                byte[] chunk = new byte[4096]; int size;
                while ((size = input.read(chunk)) != -1) { output.write(chunk, 0, size); if (output.size() > 1048576) throw new IOException("Phản hồi quá lớn."); }
                text = output.toString(StandardCharsets.UTF_8.name());
            }
            if (status < 200 || status >= 300) {
                String message = "Máy chủ trả lỗi " + status;
                try {
                    JSONObject error = new JSONObject(text).getJSONObject("error");
                    message = error.getString("message");
                    JSONObject fields = error.optJSONObject("fields");
                    if (fields != null && fields.has("code")) message = "Mã liên kết cần đúng 12 ký tự, chỉ gồm số 0–9 và chữ A–F. Hãy sao chép mã mới từ website.";
                    else if (fields != null && fields.has("consent")) message = "Cần xác nhận đồng ý chia sẻ trước khi liên kết.";
                } catch (Exception ignored) { }
                throw new HttpFailure(status, message);
            }
            return text.isEmpty() ? new JSONObject() : new JSONObject(text);
        } finally { conn.disconnect(); }
    }

    void link(String server, String code) throws Exception {
        synchronized (LOCK) {
            if (!store.read().optString("token").isEmpty()) throw new IllegalStateException("Hãy ngừng chia sẻ thiết bị hiện tại trước khi liên kết lại.");
            server = validServer(server);
            JSONObject response = request(server, "POST", "link", "", new JSONObject().put("code", PairingCode.validate(code)).put("consent", true));
            long since = Math.max(System.currentTimeMillis(), Instant.parse(response.getString("consent_at")).toEpochMilli());
            store.write(new JSONObject().put("server", server).put("token", response.getString("token"))
                    .put("time_zone", response.getString("time_zone")).put("since", since).put("tracking_since", since)
                    .put("last_attempt", 0).put("last_success", 0).put("paused", true));
        }
        SyncJob.schedule(context);
    }

    String sync() throws Exception {
        synchronized (LOCK) {
            JSONObject state = store.read();
            if (state.optString("token").isEmpty()) return "Chưa liên kết với gia đình.";
            try {
                String server = state.getString("server"), token = state.getString("token");
                boolean permission = hasPermission();
                if (!permission) {
                    state.remove("pending"); state.remove("buffered"); state.put("paused", true); store.write(state);
                    request(server, "PUT", "state", token, new JSONObject().put("state", "PERMISSION_REVOKED"));
                    return "Chưa có quyền truy cập dữ liệu sử dụng. Đã dừng thu thập và gửi dữ liệu.";
                }
                long now = System.currentTimeMillis();
                if (state.optBoolean("paused", true)) {
                    state.put("tracking_since", now).put("paused", false); state.remove("pending"); state.remove("buffered");
                }
                // Capture before any network request, retaining the latest snapshot per day offline.
                JSONObject fresh = collect(state, now);
                JSONObject buffered = state.optJSONObject("buffered");
                if (buffered == null) buffered = new JSONObject();
                JSONArray freshDays = fresh.getJSONArray("days");
                for (int i = 0; i < freshDays.length(); i++) {
                    JSONObject day = freshDays.getJSONObject(i); buffered.put(day.getString("local_date"), day);
                }
                List<String> dates = new ArrayList<>(); buffered.keys().forEachRemaining(dates::add); java.util.Collections.sort(dates);
                while (dates.size() > 7) buffered.remove(dates.remove(0));
                state.put("buffered", buffered).put("last_attempt", now); store.write(state);
                JSONObject config = request(server, "GET", "config", token, null);
                if (!state.getString("time_zone").equals(config.getString("time_zone"))) {
                    state.put("time_zone", config.getString("time_zone")).put("tracking_since", now); state.remove("pending"); state.remove("buffered");
                    store.write(state); return "Đã cập nhật múi giờ. Số liệu mới sẽ được thu từ thời điểm này.";
                }
                store.write(state);
                request(server, "PUT", "state", token, new JSONObject().put("state", "ACTIVE"));
                // A pending batch keeps its UUID and exact bytes until acknowledged.
                if (state.has("pending")) {
                    if (!hasPermission()) throw new SecurityException("Quyền đã bị tắt; đã dừng đồng bộ.");
                    request(server, "POST", "batches", token, state.getJSONObject("pending"));
                    state.remove("pending"); store.write(state);
                }
                if (buffered.length() > 0) {
                    JSONArray queuedDays = new JSONArray();
                    for (String date : dates) queuedDays.put(buffered.getJSONObject(date));
                    JSONObject batch = new JSONObject().put("batch_id", UUID.randomUUID().toString()).put("time_zone", state.getString("time_zone"))
                            .put("algorithm_version", "android-events-v1").put("days", queuedDays);
                    state.put("pending", batch); state.remove("buffered"); store.write(state);
                    if (!hasPermission()) throw new SecurityException("Quyền đã bị tắt; đã dừng đồng bộ.");
                    request(server, "POST", "batches", token, batch);
                    state.remove("pending");
                }
                state.put("last_success", now).remove("error"); store.write(state);
                return "Đã đồng bộ. Gia đình có thể xem số liệu mới trên web.";
            } catch (SecurityException error) {
                state.remove("pending"); state.remove("buffered"); state.put("paused", true); store.write(state); throw error;
            } catch (HttpFailure error) {
                if (error.status == 401 || error.status == 403) {
                    store.clear(); SyncJob.cancel(context);
                    throw new IOException("Liên kết đã bị thu hồi hoặc không còn quyền chia sẻ. Hãy liên kết lại nếu được cho phép.");
                }
                // Invalid payload/old timezone must not block all future uploads forever.
                if (error.status == 422 || error.status == 409) { state.remove("pending"); store.write(state); }
                throw error;
            }
        }
    }

    private JSONObject collect(JSONObject state, long now) throws Exception {
        ZoneId zone = ZoneId.of(state.getString("time_zone"));
        LocalDate today = Instant.ofEpochMilli(now).atZone(zone).toLocalDate();
        long tracking = state.getLong("tracking_since");
        long previousAttempt = state.optLong("last_attempt", now);
        // OS event retention is limited: do not claim complete history after a long gap.
        boolean longGap = previousAttempt > 0 && now - previousAttempt > 48 * 3600000L;
        JSONArray days = new JSONArray();
        UsageStatsManager manager = context.getSystemService(UsageStatsManager.class);
        for (int back = 2; back >= 0; back--) {
            LocalDate date = today.minusDays(back);
            long midnight = date.atStartOfDay(zone).toInstant().toEpochMilli();
            long from = Math.max(midnight, tracking);
            long until = Math.min(now, date.plusDays(1).atStartOfDay(zone).toInstant().toEpochMilli());
            if (from >= until) continue;
            UsageEvents stream = manager.queryEvents(Math.max(0, from - 24 * 3600000L), until);
            if (stream == null) continue;
            List<UsageTimeline.Event> events = new ArrayList<>();
            UsageEvents.Event e = new UsageEvents.Event();
            while (stream.hasNextEvent()) {
                stream.getNextEvent(e);
                int type = e.getEventType();
                if (type == 1 || type == 2 || type == 15 || type == 16 || type == 26) events.add(new UsageTimeline.Event(e.getTimeStamp(), type, e.getPackageName(), e.getClassName()));
            }
            // An empty retained event stream is unknown, rather than an observed zero.
            if (events.isEmpty()) continue;
            UsageTimeline.Result result = UsageTimeline.reduce(events, from, until, now);
            boolean partial = result.partial() || from != midnight || longGap;
            JSONArray apps = new JSONArray(); long appSeconds = 0;
            for (Map.Entry<String, Long> item : result.appMillis().entrySet()) {
                if (!item.getKey().matches("[a-zA-Z0-9_]+(?:\\.[a-zA-Z0-9_]+)+")) { partial = true; continue; }
                long seconds = item.getValue() / 1000;
                if (seconds == 0) continue;
                appSeconds += seconds;
                String label = item.getKey();
                try { ApplicationInfo info = context.getPackageManager().getApplicationInfo(item.getKey(), 0); label = context.getPackageManager().getApplicationLabel(info).toString(); } catch (Exception ignored) { }
                if (label.length() > 100) label = label.substring(0, 100);
                apps.put(new JSONObject().put("package_name", item.getKey()).put("label", label).put("seconds", seconds));
            }
            if (apps.length() > 500) continue;
            days.put(new JSONObject().put("local_date", date.toString()).put("observed_from", Instant.ofEpochMilli(from).toString())
                    .put("captured_at", Instant.ofEpochMilli(until).toString()).put("total_seconds", Math.min(appSeconds, result.deviceMillis() / 1000))
                    .put("coverage", partial ? "PARTIAL" : "COMPLETE").put("apps", apps));
        }
        return new JSONObject().put("batch_id", UUID.randomUUID().toString()).put("time_zone", zone.getId())
                .put("algorithm_version", "android-events-v1").put("days", days);
    }

    void stop() throws Exception {
        synchronized (LOCK) {
            JSONObject state = store.read();
            // Remove the local token and queue first; an offline revoke never resumes collection.
            store.clear(); SyncJob.cancel(context);
            if (!state.optString("token").isEmpty()) request(state.getString("server"), "DELETE", "link", state.getString("token"), null);
        }
    }
}
