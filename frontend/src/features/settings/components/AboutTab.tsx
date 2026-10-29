import Link from "next/link";
import { appConfig } from "@/core/config";
import { Card } from "@/design/components";
import { t } from "@/i18n/vi";

export function AboutTab() {
  return <Card className="flex flex-col gap-4"><h2 className="font-bold text-text">{t("appName")}</h2><p className="break-all text-sm text-body">{t("settingsExtra.version")}: {appConfig.buildId}</p><p className="text-sm text-body">{t("settingsExtra.limits")}</p><nav className="flex flex-wrap gap-4">{(["about", "privacy", "terms", "contact"] as const).map((key, index) => <Link key={key} href={["/gioi-thieu/", "/quyen-rieng-tu/", "/dieu-khoan/", "/lien-he/"][index]} className="text-sm font-semibold text-primary underline">{t(`settingsExtra.links.${key}`)}</Link>)}</nav></Card>;
}
