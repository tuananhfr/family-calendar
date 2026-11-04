package vn.lichgiadinh.screentime;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.view.View;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import org.json.JSONObject;
import java.text.DateFormat;
import java.util.Date;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class MainActivity extends Activity {
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private TextView status;
    private LinearLayout content;
    private boolean working;
    private boolean linked;
    private EditText serverInput;
    private EditText codeInput;
    private CheckBox consentInput;
    private Bundle restoredForm;
    private final Handler foregroundHandler = new Handler(Looper.getMainLooper());
    private boolean resumed;
    private final Runnable foregroundSync = new Runnable() {
        @Override public void run() {
            if (!resumed) return;
            if (linked && !working) runTask(() -> new Collector(MainActivity.this).sync());
            foregroundHandler.postDelayed(this, 60_000);
        }
    };

    @Override public void onCreate(Bundle saved) { super.onCreate(saved); restoredForm = saved; render(); }
    @Override public void onResume() {
        super.onResume(); resumed = true;
        if (content != null && !working && linked) render();
        foregroundHandler.removeCallbacks(foregroundSync);
        foregroundSync.run();
    }
    @Override public void onPause() {
        resumed = false; foregroundHandler.removeCallbacks(foregroundSync); super.onPause();
    }
    @Override protected void onSaveInstanceState(Bundle saved) {
        if (!linked && serverInput != null) {
            saved.putString("server", serverInput.getText().toString());
            saved.putString("code", codeInput.getText().toString());
            saved.putBoolean("consent", consentInput.isChecked());
        }
        super.onSaveInstanceState(saved);
    }

    private void text(String message, int size, boolean bold) {
        TextView view = new TextView(this); view.setText(message); view.setTextSize(size); view.setTextColor(Color.rgb(28, 42, 61));
        if (bold) view.setTypeface(null, android.graphics.Typeface.BOLD);
        view.setPadding(0, 12, 0, 12); content.addView(view);
    }
    private EditText field(String hint) {
        EditText input = new EditText(this); input.setHint(hint); input.setSingleLine(true);
        input.setTextSize(16); input.setMinHeight((int) (56 * getResources().getDisplayMetrics().density)); content.addView(input); return input;
    }
    private Button button(String title, View.OnClickListener action) {
        Button button = new Button(this); button.setText(title); button.setAllCaps(false); button.setMinHeight((int) (56 * getResources().getDisplayMetrics().density));
        button.setOnClickListener(action); content.addView(button); return button;
    }
    private void render() {
        ScrollView scroll = new ScrollView(this); content = new LinearLayout(this); content.setOrientation(LinearLayout.VERTICAL);
        int pad = (int) (20 * getResources().getDisplayMetrics().density); content.setPadding(pad, pad * 2, pad, pad * 2);
        content.setBackgroundColor(Color.rgb(246, 249, 254)); scroll.addView(content); setContentView(scroll);
        ImageView logo = new ImageView(this); logo.setImageResource(R.drawable.ic_launcher_foreground);
        logo.setContentDescription("Logo Lịch Gia Đình");
        int logoSize = (int) (108 * getResources().getDisplayMetrics().density);
        content.addView(logo, new LinearLayout.LayoutParams(logoSize, logoSize));
        text("Thời gian màn hình", 26, true);
        text("Lịch Gia Đình · Cùng xây dựng thói quen cân bằng", 16, false);
        status = new TextView(this); status.setTextSize(16); status.setPadding(0, 16, 0, 16); status.setAccessibilityLiveRegion(View.ACCESSIBILITY_LIVE_REGION_POLITE); content.addView(status);
        try {
            JSONObject state;
            synchronized (Collector.LOCK) { state = new PrivateStore(this).read(); }
            linked = !state.optString("token").isEmpty();
            if (!linked) {
                text("Ứng dụng chia sẻ tổng thời gian và thời lượng từng ứng dụng với gia đình đã liên kết. Không đọc tin nhắn, nội dung web, ảnh hoặc vị trí. Không khóa ứng dụng. Bạn có thể ngừng chia sẻ bất cứ lúc nào.", 16, false);
                EditText server = field("Địa chỉ máy chủ từ web"); server.setInputType(android.text.InputType.TYPE_CLASS_TEXT | android.text.InputType.TYPE_TEXT_VARIATION_URI);
                serverInput = server;
                server.setText(restoredForm != null ? restoredForm.getString("server", "") : BuildConfig.DEBUG ? "http://localhost:3004/api/v1" : "https://lichgiadinh.info/api/v1");
                if (BuildConfig.DEBUG) text("Kiểm thử local qua cáp USB: chạy adb reverse tcp:3004 tcp:3005 trên máy tính, rồi nhập http://localhost:3004/api/v1. Giữ cáp khi đồng bộ.", 14, false);
                EditText code = field("Mã liên kết 12 ký tự");
                codeInput = code;
                code.setInputType(android.text.InputType.TYPE_CLASS_TEXT | android.text.InputType.TYPE_TEXT_FLAG_CAP_CHARACTERS | android.text.InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS);
                code.setFilters(new android.text.InputFilter[]{new android.text.InputFilter.AllCaps()});
                if (restoredForm != null) code.setText(restoredForm.getString("code", ""));
                CheckBox agree = new CheckBox(this); agree.setText("Tôi hiểu dữ liệu nào được chia sẻ và đồng ý liên kết điện thoại này."); agree.setTextSize(16); content.addView(agree);
                consentInput = agree;
                Button link = button("Liên kết điện thoại", v -> {
                    try {
                        String address = Collector.validServer(server.getText().toString());
                        String pairingCode = PairingCode.validate(code.getText().toString());
                        runTask(() -> { new Collector(this).link(address, pairingCode); return "Đã liên kết. Hãy cấp quyền truy cập dữ liệu sử dụng."; });
                    } catch (Exception error) { status.setText(error.getMessage()); }
                });
                link.setEnabled(false); agree.setOnCheckedChangeListener((view, checked) -> link.setEnabled(checked));
                if (restoredForm != null) agree.setChecked(restoredForm.getBoolean("consent", false));
                restoredForm = null;
            } else {
                boolean permission = new Collector(this).hasPermission();
                text(permission ? "Quyền dữ liệu sử dụng: đã bật" : "Quyền dữ liệu sử dụng: chưa bật", 17, true);
                long last = state.optLong("last_success");
                text(last > 0 ? "Đồng bộ gần nhất: " + DateFormat.getDateTimeInstance().format(new Date(last)) : "Chưa có lần đồng bộ thành công.", 15, false);
                text("Thiết bị này được gắn với một thành viên. Nếu nhiều người cùng dùng máy, số liệu không thể xác định riêng từng người.", 15, false);
                button("Mở cài đặt quyền sử dụng", v -> startActivity(new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS, Uri.parse("package:" + getPackageName()))));
                button("Đồng bộ ngay", v -> runTask(() -> new Collector(this).sync()));
                button("Ngừng chia sẻ và xóa dữ liệu trên máy", v -> new AlertDialog.Builder(this).setTitle("Ngừng chia sẻ?")
                        .setMessage("Điện thoại sẽ xóa liên kết và hàng đợi. Dữ liệu đã gửi vẫn còn trên web cho đến khi bạn xóa. Nếu mất mạng, hãy gỡ liên kết trên web để thu hồi phía máy chủ.")
                        .setNegativeButton("Quay lại", null).setPositiveButton("Ngừng chia sẻ", (dialog, which) -> runTask(() -> { new Collector(this).stop(); return "Đã ngừng chia sẻ trên điện thoại."; })).show());
                text("Tự đồng bộ khi mở lại ứng dụng và mỗi phút khi ứng dụng đang mở. Khi chạy nền, Android lên lịch khoảng 15 phút hoặc lâu hơn lúc tiết kiệm pin. Không cần bấm Đồng bộ ngay mỗi lần. Mất mạng thì chờ gửi lại; số liệu bắt đầu từ lúc đồng ý và có thể thiếu khi tắt quyền.", 15, false);
                SyncJob.schedule(this);
            }
        } catch (Exception error) { status.setText("Không đọc được dữ liệu cục bộ. Hãy xóa dữ liệu ứng dụng để liên kết lại."); }
    }
    private interface Work { String execute() throws Exception; }
    private void runTask(Work work) {
        if (working) return; working = true; status.setText("Đang xử lý…");
        worker.submit(() -> {
            String result;
            boolean success;
            try { result = work.execute(); success = true; } catch (Exception error) { result = "Chưa hoàn tất: " + (error.getMessage() == null ? "Kiểm tra kết nối rồi thử lại." : error.getMessage()); success = false; }
            String message = result;
            boolean refresh = success;
            runOnUiThread(() -> { working = false; if (!isFinishing() && !isDestroyed()) { if (refresh) render(); status.setText(message); } });
        });
    }
    @Override public void onDestroy() { foregroundHandler.removeCallbacks(foregroundSync); worker.shutdown(); super.onDestroy(); }
}
