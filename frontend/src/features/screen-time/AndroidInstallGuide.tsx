"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { Copy, ShieldCheck } from "lucide-react";
import { appConfig } from "@/core/config";
import { Button, Card, TextField } from "@/design/components";
import { AndroidAppDownload } from "./AndroidAppDownload";

const subscribeOrigin = () => () => {};
const currentApi = () => `${window.location.origin}${appConfig.apiBase}`;
const serverApi = () => `${appConfig.siteOrigin}${appConfig.apiBase}`;

export function AndroidInstallGuide() {
  const apiAddress = useSyncExternalStore(
    subscribeOrigin,
    currentApi,
    serverApi,
  );
  const [copyStatus, setCopyStatus] = useState("");
  const https = apiAddress.startsWith("https://");
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold text-text sm:text-3xl">
          Tải ứng dụng Android
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-body">
          Dành cho điện thoại Android của con. Có thể tải và đọc hướng dẫn mà
          không cần đăng nhập trên điện thoại này.
        </p>
      </div>
      <AndroidAppDownload showGuide={false} />
      <Card className="flex flex-col gap-4">
        <h2 className="font-bold text-text">
          Cài đặt và liên kết trong 4 bước
        </h2>
        <ol className="list-decimal space-y-4 pl-5 text-sm leading-relaxed text-body">
          <li>
            <strong>Tải và cài APK.</strong> Bấm nút tải ở trên, mở tệp vừa tải.
            Nếu Android hỏi, cho phép trình duyệt hoặc ứng dụng Tệp cài ứng dụng
            từ nguồn này, rồi chọn Cài đặt.
          </li>
          <li>
            <strong>Tạo mã trên website.</strong> Bố mẹ mở Thời gian màn hình,
            chọn hồ sơ con, xác nhận quyền chia sẻ và tạo mã liên kết mới. Mã có
            hiệu lực 10 phút và dùng một lần.
          </li>
          <li>
            <strong>Liên kết trên điện thoại con.</strong> Mở app “Lịch Gia Đình
            · Thời gian màn hình”, nhập địa chỉ máy chủ bên dưới và mã liên kết.
            Đọc nội dung chia sẻ rồi xác nhận đồng ý.
          </li>
          <li>
            <strong>Cấp quyền sử dụng.</strong> Chọn Mở cài đặt quyền sử dụng,
            bật quyền cho app rồi quay lại. App tự gửi số liệu khi mở lại, mỗi
            phút khi đang mở và theo lịch nền khoảng 15 phút.
          </li>
        </ol>
        <TextField
          label="Địa chỉ máy chủ nhập trong app Android"
          value={apiAddress}
          readOnly
        />
        {!https && (
          <p className="text-sm text-warning">
            Bạn đang mở bản local. Để dùng APK này trên điện thoại thật, hãy mở
            trang hướng dẫn bằng địa chỉ HTTPS của website đã triển khai.
          </p>
        )}
        <Button
          className="self-start"
          variant="secondary"
          disabled={!https}
          icon={<Copy className="size-4" />}
          onClick={() => {
            void navigator.clipboard
              .writeText(apiAddress)
              .then(() => setCopyStatus("Đã sao chép địa chỉ máy chủ."))
              .catch(() =>
                setCopyStatus("Hãy chọn và sao chép địa chỉ thủ công."),
              );
          }}
        >
          Sao chép địa chỉ máy chủ
        </Button>
        <p role="status" aria-live="polite" className="text-sm text-body">
          {copyStatus}
        </p>
      </Card>
      <Card className="flex flex-col gap-3">
        <h2 className="flex items-center gap-2 font-bold text-text">
          <ShieldCheck aria-hidden className="size-5 text-success" />
          Những điều cần biết
        </h2>
        <p className="text-sm leading-relaxed text-body">
          App chỉ ghi nhận thời lượng và tên ứng dụng sau khi đồng ý và cấp
          quyền; không đọc tin nhắn, nội dung web, ảnh hay vị trí. Có thể ngừng
          chia sẻ ngay trong app.
        </p>
        <p className="text-sm leading-relaxed text-body">
          Dữ liệu bắt đầu từ lúc liên kết và cấp quyền, không lấy lịch sử trước
          đó. Giới hạn pin hoặc mất mạng có thể làm báo cáo cập nhật chậm. Không
          cần cáp USB khi điện thoại kết nối được máy chủ HTTPS qua Internet.
        </p>
        <p className="text-sm leading-relaxed text-body">
          Thêm website vào màn hình chính chỉ giúp mở báo cáo thuận tiện; để đo
          thời gian trên Android cần cài APK này. iPhone hiện dùng website để
          xem báo cáo, chưa thu thập thời gian sử dụng tự động.
        </p>
        <div className="flex flex-wrap gap-4 text-sm font-semibold text-primary">
          <Link href="/thoi-gian-man-hinh/" className="underline">
            Mở Thời gian màn hình
          </Link>
          <Link href="/quyen-rieng-tu/" className="underline">
            Quyền riêng tư
          </Link>
        </div>
      </Card>
    </div>
  );
}
