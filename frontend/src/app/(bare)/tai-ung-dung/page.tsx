import { publicPageMetadata } from "@/core/seo/metadata";
import { AndroidInstallGuide } from "@/features/screen-time/AndroidInstallGuide";

export const metadata = publicPageMetadata("androidDownload");

export default function AndroidDownloadPage() {
  return <AndroidInstallGuide />;
}
