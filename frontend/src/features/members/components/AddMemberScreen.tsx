"use client";

import { useSearchParams } from "next/navigation";
import { UserRoundPlus } from "lucide-react";
import { hasLevel } from "@/core/access/evaluate";
import { EmptyState, ForbiddenState, PageHeader, SkeletonList, Tabs } from "@/design/components";
import { t } from "@/i18n/vi";
import { useAccess } from "../hooks/useAccess";
import { useActiveSpace } from "../hooks/useActiveSpace";
import { useMember } from "../hooks/useMembers";
import { useSpaceToday } from "../hooks/useSpaceToday";
import { InviteStepsPanel } from "./InviteStepsPanel";
import { InviteScreen } from "@/features/invites/components/InviteScreen";
import { SharingPanel } from "@/features/sharing/components/SharingPanel";
import { MemberForm } from "./MemberForm";

/** `/thanh-vien/them/` adds; `?id=` edits the same form (static export has no dynamic segments). */
export function AddMemberScreen() {
  const params = useSearchParams();
  const id = params.get("id");
  const { space } = useActiveSpace();
  const access = useAccess();
  const today = useSpaceToday();
  const existing = useMember(id);

  if (!space || !access || existing === undefined) return <SkeletonList rows={4} />;
  if (!hasLevel(access, "members", "EDIT")) return <ForbiddenState />;
  if (id && (existing === null || existing.spaceId !== space.id)) return <EmptyState title={t("members.notFound")} illustration="footer-members" />;

  const header = (
    <PageHeader
      title={t(existing ? "members.form.editTitle" : "members.form.addTitle")}
      subtitle={t("members.form.subtitle")}
      icon={<UserRoundPlus />}
      illustration="corner-add-member"
    />
  );

  if (existing) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <MemberForm key={existing.id} spaceId={space.id} existing={existing} today={today} />
      </div>
    );
  }

  const invite = (
    <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <SharingPanel />
      <InviteStepsPanel />
    </div>
  );
  return (
    <div className="flex flex-col gap-6">
      {header}
      <Tabs
        label={t("members.form.addTitle")}
        value={["link", "email"].includes(params.get("tab") ?? "") ? params.get("tab")! : "manual"}
        onValueChange={(value) => { const url = new URL(location.href); url.searchParams.set("tab", value); history.replaceState(null, "", url.pathname + url.search); }}
        items={[
          {
            value: "manual",
            label: t("members.form.tabs.manual"),
            content: <MemberForm spaceId={space.id} today={today} />,
          },
          {
            value: "link",
            label: t("members.form.tabs.link"),
            content: space.sharingState === "SHARED" ? <InviteScreen spaceId={space.id} /> : invite,
          },
          {
            value: "email",
            label: t("members.form.tabs.email"),
            content: space.sharingState === "SHARED" ? <InviteScreen spaceId={space.id} emailMode /> : invite,
          },
        ]}
      />
    </div>
  );
}
