"use client";
import Link from "next/link";
import { Card, buttonClass } from "@/design/components";
import { t } from "@/i18n/vi";
import { DraftsPanel } from "./DraftsPanel";
export function AccessLossPanel({ revoked }: { revoked: boolean }) {
  return <Card className="mx-auto flex w-full max-w-xl flex-col gap-4">
    <h1 className="text-xl font-bold text-text">{t(revoked ? "sharing.blocked" : "sharing.copyRemoved")}</h1>
    <p className="text-sm text-body">{t(revoked ? "sharing.accessLostHint" : "sharing.copyRemovedHint")}</p>
    <Link href="/dang-nhap/" className={buttonClass()}>{t("sharing.login")}</Link>
    <Link href="/khoi-phuc/" className={buttonClass("secondary")}>{t("sharing.recover")}</Link>
    <Link href="/bat-dau/" className="text-sm text-primary underline">{t("sharing.createLocal")}</Link>
    <DraftsPanel />
  </Card>;
}
