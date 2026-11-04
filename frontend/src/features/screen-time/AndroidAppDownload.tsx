import Link from "next/link";
import Image from "next/image";
import { Download } from "lucide-react";
import { withBase } from "@/core/config";
import { Card, buttonClass } from "@/design/components";
import release from "../../../public/downloads/android-release.json";

export const androidDownloadHref = withBase(
  `/downloads/${release.fileName}?v=${release.versionCode}-${release.sha256.slice(0, 12)}`,
);

export function AndroidAppDownload({
  showGuide = true,
}: {
  showGuide?: boolean;
}) {
  return (
    <Card className="flex flex-col gap-4 border-primary/25 bg-primary-soft/40 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <span className="shrink-0 rounded-2xl bg-surface p-2">
          <Image
            src={withBase("/icons/icon-192-20261103.png")}
            alt="Logo Lịch Gia Đình"
            width={40}
            height={40}
            className="size-10 object-contain"
          />
        </span>
        <div className="min-w-0">
          <h2 className="font-bold text-text">
            Cài app trên điện thoại Android của con
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-body">
            Cài app và cấp quyền để ghi nhận thời gian sử dụng. Bố mẹ xem báo
            cáo trên website. APK này chỉ có chức năng thời gian màn hình;
            lịch và các tiện ích gia đình dùng trên website.
          </p>
          <p className="mt-2 text-xs text-muted">
            Android {release.minAndroid}+ · Phiên bản {release.versionName} ·{" "}
            {new Intl.NumberFormat("vi-VN", {
              maximumFractionDigits: 0,
            }).format(release.bytes / 1024)}{" "}
            KB
          </p>
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-start gap-2 sm:items-center">
        <a
          href={androidDownloadHref}
          download={release.fileName}
          className={buttonClass("primary")}
        >
          <Download aria-hidden className="size-4" />
          Tải app Android (.apk)
        </a>
        {showGuide && (
          <Link
            href="/tai-ung-dung/"
            className="text-sm font-semibold text-primary underline underline-offset-4"
          >
            Hướng dẫn cài trên điện thoại
          </Link>
        )}
      </div>
    </Card>
  );
}
