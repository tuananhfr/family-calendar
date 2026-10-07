"use client";

import { useState, type ReactNode } from "react";
import { AudioLines, BellRing, Check, Lock, MapPin, Pencil, Repeat, SkipForward, StickyNote, Trash2, Undo2, Users } from "lucide-react";
import { canWriteItem } from "@/core/access/evaluate";
import { PARTICIPATION_RESPONSES } from "@/core/model/occurrence";
import type { Space } from "@/core/model/space";
import type { EditScope } from "@/core/recurrence/edit-scope";
import { instantToZoned, timePart } from "@/core/time/zoned";
import { Badge, Button, CategoryTag, Checkbox, Chip, Dialog, PriorityTag, SkeletonList, toast } from "@/design/components";
import { MemberAvatar, useAccess, useMembers } from "@/features/members";
import { AttachmentStrip } from "@/features/storage";
import { t } from "@/i18n/vi";
import { useAppStore } from "@/store/app.store";
import { useItemMutations } from "../hooks/useItemMutations";
import { useOccurrenceDetail } from "../hooks/useOccurrenceDetail";
import { itemTypeOf } from "../model/item-types";
import { setChecklistChecked, setParticipation } from "../model/item-writes";
import { formatWhen } from "../model/occurrence-label";
import { DEFAULT_SNOOZE_MINUTES, type OccurrenceAction } from "../model/occurrence-actions";
import { repeatFromSchedule } from "../model/repeat-presets";
import { TYPE_ICON } from "./AddNewModal";
import { VoiceNotePlayer } from "./AudioRecorder";
import { EditScopeDialog } from "./EditScopeDialog";

function Row({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <span aria-hidden className="mt-0.5 text-muted [&_svg]:size-4">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <dt className="text-xs font-semibold text-muted">{label}</dt>
        <dd className="break-words text-sm text-text">{children}</dd>
      </div>
    </div>
  );
}

function repeatText(schedule: Parameters<typeof repeatFromSchedule>[0]): string | null {
  const kind = repeatFromSchedule(schedule).kind;
  if (kind === "NONE") return null;
  if (kind === "LUNAR_YEARLY") return `${t("items.repeat.YEARLY")} · ${t("items.calendarSystem.LUNAR")}`;
  if (kind === "LUNAR_MONTHLY") return `${t("items.repeat.MONTHLY")} · ${t("items.calendarSystem.LUNAR")}`;
  return t(`items.repeat.${kind}`);
}

/** "Chi tiết sự kiện": act on exactly this occurrence (Đã xong / Nhắc lại / Bỏ qua), tick its checklist, RSVP. */
export function ItemDetailDialog({ itemId, occurrenceKey, space, onClose, onEdit }: { itemId: string; occurrenceKey: string; space: Space; onClose: () => void; onEdit: () => void }) {
  const detail = useOccurrenceDetail(itemId, occurrenceKey);
  const members = useMembers(space.id) ?? [];
  const access = useAccess();
  const usingMemberId = useAppStore((s) => s.usingMemberId);
  const mutations = useItemMutations();
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<"confirm" | "scope" | null>(null);

  const run = async (fn: () => Promise<void>, done?: string) => {
    setBusy(true);
    try {
      await fn();
      if (done) toast(done, "success");
    } catch {
      toast(t("items.errors.UNKNOWN"), "error");
    } finally {
      setBusy(false);
    }
  };
  const act = (action: OccurrenceAction) => run(() => mutations.act(itemId, occurrenceKey, action));
  const remove = (scope: EditScope) =>
    run(async () => {
      const title = detail?.occurrence.title ?? "";
      await mutations.remove(itemId, scope, occurrenceKey);
      toast(t("items.deletedToast", { title }), "success");
      onClose();
    });

  if (detail === undefined || detail === null) {
    return (
      <Dialog open onOpenChange={(o) => !o && onClose()} size="md" title={t("items.detail.title")}>
        {detail === null ? <p className="py-8 text-center text-sm text-muted">{t("items.detail.notFound")}</p> : <SkeletonList rows={3} />}
      </Dialog>
    );
  }

  const { item, occurrence, state } = detail;
  const type = itemTypeOf(item);
  const TypeIcon = TYPE_ICON[type];
  const writable = !!access && canWriteItem(access, item);
  const people = members.filter((m) => item.memberIds.includes(m.id));
  const repeat = repeatText(item.schedule);
  const snoozeTime = state?.snoozeUntil ? timePart(instantToZoned(new Date(state.snoozeUntil), space.timeZone)) : null;
  const myAnswer = usingMemberId ? detail.participations.find((p) => p.memberId === usingMemberId)?.response : undefined;

  if (deleting === "scope") return <EditScopeDialog mode="delete" busy={busy} onCancel={() => setDeleting(null)} onConfirm={(s) => void remove(s)} />;
  if (deleting === "confirm") {
    return (
      <Dialog
        open
        onOpenChange={(o) => !o && setDeleting(null)}
        size="sm"
        icon={<Trash2 />}
        title={t("items.detail.deleteConfirmTitle", { title: occurrence.title })}
        description={t("items.detail.deleteConfirmBody")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleting(null)} disabled={busy}>
              {t("common.cancel")}
            </Button>
            <Button variant="danger" onClick={() => void remove("ALL")} loading={busy}>
              {t("common.delete")}
            </Button>
          </>
        }
      />
    );
  }

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      size="md"
      icon={<TypeIcon />}
      title={occurrence.title}
      description={formatWhen(occurrence)}
      footer={
        writable ? (
          <>
            <Button variant="ghost" className="mr-auto text-danger" icon={<Trash2 className="size-4" />} onClick={() => setDeleting(detail.recurring ? "scope" : "confirm")} disabled={busy}>
              {t("items.detail.delete")}
            </Button>
            <Button icon={<Pencil className="size-4" />} onClick={onEdit} disabled={busy}>
              {t("items.detail.edit")}
            </Button>
          </>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-5 pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <CategoryTag category={item.category} />
          <PriorityTag priority={item.priority} />
          {item.sharingScope === "PRIVATE" ? (
            <Badge tone="neutral" icon={<Lock aria-hidden className="size-3.5" />}>
              {t("items.detail.private")}
            </Badge>
          ) : null}
          {state ? (
            <Badge tone={state.status === "DONE" ? "success" : "neutral"} icon={state.status === "DONE" ? <Check aria-hidden className="size-3.5" /> : undefined}>
              {state.status === "SNOOZED" && snoozeTime ? t("items.detail.status.SNOOZED", { time: snoozeTime }) : t(`items.detail.status.${state.status}`)}
            </Badge>
          ) : null}
        </div>

        {writable ? (
          <div className="flex flex-wrap gap-2">
            {state ? (
              <Button variant="secondary" icon={<Undo2 className="size-4" />} onClick={() => void act("UNDO")} loading={busy}>
                {t("items.detail.undo")}
              </Button>
            ) : (
              <>
                <Button variant="soft" icon={<Check className="size-4" />} onClick={() => void act("DONE")} loading={busy}>
                  {t("items.detail.done")}
                </Button>
                {type === "REMINDER" || detail.hasRule ? (
                  <Button variant="secondary" icon={<BellRing className="size-4" />} onClick={() => void act("SNOOZE")} disabled={busy}>
                    {t("items.detail.snooze", { n: DEFAULT_SNOOZE_MINUTES })}
                  </Button>
                ) : null}
                {detail.recurring ? (
                  <Button variant="secondary" icon={<SkipForward className="size-4" />} onClick={() => void act("SKIP")} disabled={busy}>
                    {t("items.detail.skip")}
                  </Button>
                ) : null}
              </>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted">{t("items.detail.readOnly")}</p>
        )}

        <dl className="flex flex-col gap-3">
          {repeat ? (
            <Row icon={<Repeat />} label={t("items.detail.repeat")}>
              {repeat}
            </Row>
          ) : null}
          {item.locationText ? (
            <Row icon={<MapPin />} label={t("items.detail.location")}>
              {item.locationText}
            </Row>
          ) : null}
          {people.length ? (
            <Row icon={<Users />} label={t("items.detail.members")}>
              <span className="mt-1 flex flex-wrap gap-2">
                {people.map((m) => (
                  <span key={m.id} className="inline-flex items-center gap-1.5 rounded-chip bg-surface-2 py-0.5 pl-0.5 pr-2.5">
                    <MemberAvatar name={m.displayName} avatar={m.avatar} relationship={m.relationship} size="sm" />
                    {m.displayName}
                  </span>
                ))}
              </span>
            </Row>
          ) : null}
          {item.note ? (
            <Row icon={<StickyNote />} label={t("items.detail.note")}>
              <span className="whitespace-pre-line">{item.note}</span>
            </Row>
          ) : null}
          {item.audioAssetId ? (
            <Row icon={<AudioLines />} label={t("audio.label")}>
              <VoiceNotePlayer blobId={item.audioAssetId} className="mt-1" />
            </Row>
          ) : null}
        </dl>

        <AttachmentStrip ids={item.attachments} />

        {detail.checklist.length ? (
          <section aria-labelledby="detail-checklist">
            <h3 id="detail-checklist" className="mb-1 text-sm font-bold text-text">
              {t("items.detail.checklist")}
            </h3>
            {detail.checklist.map(({ line, checked }) => (
              <Checkbox
                key={line.id}
                checked={checked}
                strikeWhenChecked
                disabled={!writable}
                label={line.text}
                onCheckedChange={(on) => void run(() => setChecklistChecked(itemId, line.id, occurrenceKey, on))}
              />
            ))}
          </section>
        ) : null}

        {space.kind === "GROUP" ? (
          <section aria-labelledby="detail-rsvp">
            <h3 id="detail-rsvp" className="mb-2 text-sm font-bold text-text">
              {t("items.detail.participation")}
            </h3>
            {usingMemberId ? (
              <div className="flex flex-wrap gap-2">
                {PARTICIPATION_RESPONSES.map((r) => (
                  <Chip key={r} selected={myAnswer === r} onClick={() => void run(() => setParticipation(itemId, occurrenceKey, usingMemberId, r))}>
                    {t(`items.detail.response.${r}`)}
                  </Chip>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted">{t("items.detail.participationNeedsMember")}</p>
            )}
          </section>
        ) : null}
      </div>
    </Dialog>
  );
}
