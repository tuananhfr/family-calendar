"use client";

import Link from "next/link";
import { Plus, ShieldCheck, UsersRound } from "lucide-react";
import { hasLevel } from "@/core/access/evaluate";
import { Button, buttonClass, ForbiddenState, Illustration, PageHeader, ScriptText, SectionCard, SkeletonList, toast } from "@/design/components";
import { t } from "@/i18n/vi";
import { useAccess } from "../hooks/useAccess";
import { useActiveSpace } from "../hooks/useActiveSpace";
import { useMemberMutations } from "../hooks/useMemberMutations";
import { useMembers } from "../hooks/useMembers";
import { useSpaceToday } from "../hooks/useSpaceToday";
import { memberSubtitle } from "../model/relationship";
import { AddMemberCard, MemberCard } from "./MemberCard";
import { MemberAvatar } from "./MemberAvatar";

export function MembersScreen() {
  const { space } = useActiveSpace();
  const members = useMembers(space?.id);
  const access = useAccess();
  const today = useSpaceToday();
  const { restore } = useMemberMutations();

  if (!access || members === undefined) return <SkeletonList rows={3} />;
  if (!hasLevel(access, "members", "VIEW")) return <ForbiddenState />;
  const canEdit = hasLevel(access, "members", "EDIT");
  const active = members.filter((m) => m.status === "ACTIVE");
  const archived = members.filter((m) => m.status === "ARCHIVED");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("members.title")}
        subtitle={t("members.subtitle")}
        icon={<UsersRound />}
        actions={
          canEdit ? (
            <>
              <Link href="/quyen/" className={buttonClass("secondary", "md")}>
                <ShieldCheck aria-hidden className="size-4" />
                {t("members.managePermissions")}
              </Link>
              <Link href="/thanh-vien/them/" className={buttonClass("primary", "md")}>
                <Plus aria-hidden className="size-4" />
                {t("members.add")}
              </Link>
            </>
          ) : null
        }
      />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
        {active.map((m) => (
          <MemberCard key={m.id} member={m} today={today} />
        ))}
        {canEdit ? <AddMemberCard /> : null}
        <div className="relative col-span-full flex min-h-48 items-end justify-between gap-4 overflow-hidden rounded-card border border-border bg-surface px-5 pt-4 md:col-span-2 xl:col-span-3">
          <Illustration name="footer-members" height={190} className="max-w-[70%] self-end" />
          {/* Wrapper carries the breakpoint: ScriptText's own inline-flex would override `hidden`. */}
          <div className="mb-6 hidden text-right sm:block">
            <ScriptText className="text-xl">{t("members.footerScript")}</ScriptText>
          </div>
        </div>
      </div>
      {archived.length ? (
        <SectionCard title={t("members.archived")}>
          <ul className="divide-y divide-border">
            {archived.map((m) => (
              <li key={m.id} className="flex min-w-0 items-center gap-3 py-2.5">
                <MemberAvatar name={m.displayName} avatar={m.avatar} relationship={m.relationship} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-text">{m.displayName}</p>
                  <p className="truncate text-xs text-muted">{memberSubtitle(m, today)}</p>
                </div>
                {canEdit ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={async () => {
                      await restore(m);
                      toast(t("members.restoredToast", { name: m.displayName }), "success");
                    }}
                  >
                    {t("members.restore")}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </SectionCard>
      ) : null}
    </div>
  );
}
