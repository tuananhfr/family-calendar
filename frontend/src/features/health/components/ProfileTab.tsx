"use client";

import { NotebookPen, Pencil, Trash2 } from "lucide-react";
import type { Member } from "@/core/model/member";
import { Button, Card, ChipGroup, EmptyState, IconButton } from "@/design/components";
import { MemberAvatar } from "@/features/members";
import { t } from "@/i18n/vi";
import type { HealthData } from "../hooks/useHealth";
import { vnDate } from "../model/health-view";
import type { HealthDialog } from "./HealthDialogs";
import { memberHealthLine } from "./member-line";

function Row({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-border py-2.5 last:border-0 sm:flex-row sm:gap-4">
      <dt className="text-sm text-muted sm:w-48 sm:shrink-0">{label}</dt>
      <dd className="min-w-0 break-words text-sm font-medium text-text">{value || <span className="font-normal text-muted">{t("health.profile.none")}</span>}</dd>
    </div>
  );
}

/** "Hồ sơ sức khỏe": one member at a time (?tv=), their record and dated notes. */
export function ProfileTab({ data, member, onMember, open }: { data: HealthData; member: Member; onMember: (id: string) => void; open: (d: HealthDialog) => void }) {
  const profile = data.profiles.find((p) => p.memberId === member.id);
  const notes = data.notes.filter((n) => n.memberId === member.id).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return (
    <div className="flex flex-col gap-4">
      <ChipGroup label={t("health.members.title")} value={member.id} onChange={onMember} options={data.members.map((m) => ({ value: m.id, label: m.displayName }))} />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card className="flex min-w-0 flex-col gap-3" data-testid="health-profile">
          <div className="flex items-center gap-3">
            <MemberAvatar name={member.displayName} avatar={member.avatar} relationship={member.relationship} size="lg" />
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-base font-bold text-text">{t("health.profile.title", { name: member.displayName })}</h2>
              <p className="truncate text-sm text-muted">{memberHealthLine(member, profile, data.today)}</p>
            </div>
            {data.canEdit ? (
              <Button variant="secondary" size="sm" icon={<Pencil className="size-4" />} onClick={() => open({ kind: "profile", member })}>
                {t("health.profile.edit")}
              </Button>
            ) : null}
          </div>
          <dl className="flex flex-col">
            <Row label={t("health.profile.sex")} value={profile && profile.sex !== "UNSPECIFIED" ? t(`health.sexes.${profile.sex}`) : undefined} />
            <Row label={t("health.profile.bloodType")} value={profile?.bloodType} />
            <Row label={t("health.profile.height")} value={profile?.heightCm ? String(profile.heightCm).replace(".", ",") : undefined} />
            <Row label={t("health.profile.allergies")} value={profile?.allergies.join(", ")} />
            <Row label={t("health.profile.conditions")} value={profile?.conditions.join(", ")} />
            <Row label={t("health.profile.insurance")} value={profile?.insuranceNumber} />
            <Row label={t("health.profile.emergencyNote")} value={profile?.emergencyNote} />
          </dl>
        </Card>
        <Card className="flex min-w-0 flex-col gap-3">
          <div className="flex items-center gap-2">
            <h2 className="min-w-0 flex-1 truncate text-base font-bold text-text">{t("health.profile.notes")}</h2>
            {data.canEdit ? (
              <Button variant="secondary" size="sm" icon={<NotebookPen className="size-4" />} onClick={() => open({ kind: "note", memberId: member.id })}>
                {t("common.add")}
              </Button>
            ) : null}
          </div>
          {notes.length === 0 ? (
            <EmptyState title={t("health.profile.notesEmpty")} className="py-4" />
          ) : (
            <ul className="flex flex-col divide-y divide-border" data-testid="health-notes">
              {notes.map((n) => (
                <li key={n.id} className="flex items-start gap-2 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-sm font-semibold text-text">{n.title}</p>
                    <p className="text-xs tabular-nums text-muted">{vnDate(n.date)}</p>
                    {n.body ? <p className="mt-1 whitespace-pre-line break-words text-sm text-body">{n.body}</p> : null}
                  </div>
                  {data.canEdit ? (
                    <IconButton
                      label={t("health.note.delete", { title: n.title })}
                      icon={<Trash2 className="size-4" />}
                      variant="ghost"
                      onClick={() => open({ kind: "delete", type: "health_note", id: n.id, question: t("health.note.confirmDelete", { title: n.title }), done: t("health.note.deleted") })}
                    />
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
