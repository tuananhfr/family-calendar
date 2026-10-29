"use client";
import Link from "next/link";
import type { Space } from "@/core/model/space";
import type { AccessContext } from "@/core/access/evaluate";
import { hasLevel } from "@/core/access/evaluate";
import { Card, buttonClass } from "@/design/components";
import { SharingPanel } from "@/features/sharing/components/SharingPanel";
import { InviteScreen } from "@/features/invites/components/InviteScreen";
import { t } from "@/i18n/vi";

export function GroupWorkspace({ space, access }: { space: Space; access?: AccessContext }) {
  const canManage = !!access && hasLevel(access, "members", "EDIT");
  return <section className="flex flex-col gap-4" aria-label={t("groups.current")}>
    <Card className="flex flex-col gap-3"><h2 className="break-words text-lg font-bold text-text">{t("groups.current")}: {space.name}</h2><div className="flex flex-wrap gap-2"><Link href="/lich/" className={buttonClass("primary")}>{t("groups.openCalendar")}</Link>{canManage && <Link href="/quyen/" className={buttonClass("secondary")}>{t("groups.managePermissions")}</Link>}</div></Card>
    {space.sharingState === "LOCAL" ? <SharingPanel /> : canManage ? <InviteScreen spaceId={space.id} spaceKind="GROUP" /> : <p className="text-sm text-body">{t("groups.noPermission")}</p>}
  </section>;
}
