package vn.lichgiadinh.screentime;

import java.util.Locale;

final class PairingCode {
    private PairingCode() {}

    static String validate(String input) {
        String code = input.replaceAll("[\\s\\p{Zs}]+", "").toUpperCase(Locale.ROOT);
        if (code.isEmpty()) throw new IllegalArgumentException("Hãy nhập mã liên kết mới tạo trên website.");
        if (code.length() != 12) throw new IllegalArgumentException("Mã liên kết cần đúng 12 ký tự; hiện có " + code.length() + ". Hãy sao chép lại mã trên website.");
        if (!code.matches("[A-F0-9]{12}")) throw new IllegalArgumentException("Mã liên kết chỉ gồm số 0–9 và chữ A–F. Kiểm tra số 0 có bị nhập thành chữ O không.");
        return code;
    }
}
