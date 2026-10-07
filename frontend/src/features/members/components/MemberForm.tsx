"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive } from "lucide-react";
import { RELATIONSHIPS, type Relationship } from "@/core/model/common";
import type { Member } from "@/core/model/member";
import { StorageFullError } from "@/core/repo/write";
import type { LocalDate } from "@/core/time/local-date";
import { Button, buttonClass, Card, Checkbox, DateField, Select, TextArea, TextField, toast } from "@/design/components";
import { t } from "@/i18n/vi";
import { useMemberMutations } from "../hooks/useMemberMutations";
import { validateAvatarFile } from "../model/avatar";
import { emptyDraft, memberToDraft, validateMemberDraft, type MemberDraft, type MemberDraftErrors } from "../model/member-draft";
import { relationshipLabel } from "../model/relationship";
import { resizeAvatar } from "../model/resize-image";
import { AvatarPicker } from "./AvatarPicker";
import { InterestsField } from "./InterestsField";
import { InviteStepsPanel } from "./InviteStepsPanel";
import { MemberPreview } from "./MemberPreview";
import { PhotoDrop } from "./PhotoDrop";

const errorText = (code?: string) => (code ? t(`members.errors.${code}`) : undefined);
const FIELD_ORDER = ["displayName", "relationship", "birthDate", "phone", "email", "interests", "note"] as const;

export function MemberForm({ spaceId, existing, today }: { spaceId: string; existing?: Member; today: LocalDate }) {
  const router = useRouter();
  const { save, archive } = useMemberMutations();
  const [draft, setDraft] = useState<MemberDraft>(() => (existing ? memberToDraft(existing) : emptyDraft()));
  const [errors, setErrors] = useState<MemberDraftErrors>({});
  const [photo, setPhoto] = useState<{ blob: Blob; url: string }>();
  const [photoError, setPhotoError] = useState<string>();
  const [photoBusy, setPhotoBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => () => (photo ? URL.revokeObjectURL(photo.url) : undefined), [photo]);

  const set = <K extends keyof MemberDraft>(key: K, value: MemberDraft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    if (errors[key as keyof MemberDraftErrors]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const relationshipOptions = useMemo(() => RELATIONSHIPS.map((r) => ({ value: r, label: relationshipLabel(r) })), []);

  const onPhoto = async (file: File) => {
    const invalid = validateAvatarFile(file);
    if (invalid) {
      setPhotoError(t(`members.errors.${invalid}`));
      return;
    }
    setPhotoError(undefined);
    setPhotoBusy(true);
    try {
      const blob = await resizeAvatar(file);
      setPhoto({ blob, url: URL.createObjectURL(blob) });
    } catch {
      setPhotoError(t("members.errors.IMAGE_UNREADABLE"));
    } finally {
      setPhotoBusy(false);
    }
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const found = validateMemberDraft(draft, today);
    setErrors(found);
    const first = FIELD_ORDER.find((f) => found[f]);
    if (first) {
      document.querySelector<HTMLElement>(`[data-field="${first}"] input, [data-field="${first}"] button, [data-field="${first}"] textarea`)?.focus();
      return;
    }
    setSubmitting(true);
    try {
      const saved = await save({
        spaceId,
        draft,
        existing,
        photo: photo?.blob,
      });
      toast(
        t(existing ? "members.form.savedToast" : "members.form.addedToast", {
          name: saved.displayName,
        }),
        "success",
      );
      router.push("/thanh-vien/");
    } catch (err) {
      toast(t(err instanceof StorageFullError ? "members.errors.STORAGE_FULL" : "members.errors.UNKNOWN"), "error");
      setSubmitting(false);
    }
  };

  const onArchive = async () => {
    if (!existing) return;
    await archive(existing);
    toast(t("members.archivedToast", { name: existing.displayName }));
    router.push("/thanh-vien/");
  };

  return (
    <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <form onSubmit={onSubmit} noValidate className="min-w-0">
        <Card className="flex flex-col gap-5">
          <h2 className="text-base font-bold text-text">{t("members.form.section")}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div data-field="displayName">
              <TextField
                label={t("members.form.name")}
                required
                maxLength={50}
                autoComplete="off"
                placeholder={t("members.form.namePlaceholder")}
                value={draft.displayName}
                onChange={(e) => set("displayName", e.target.value)}
                error={errorText(errors.displayName)}
              />
            </div>
            <div data-field="relationship">
              <Select
                label={t("members.form.relationship")}
                required
                placeholder={t("members.form.relationshipPlaceholder")}
                options={relationshipOptions}
                value={draft.relationship || undefined}
                onValueChange={(v) => set("relationship", v as Relationship)}
                error={errorText(errors.relationship)}
              />
            </div>
          </div>
          <AvatarPicker
            name={draft.displayName}
            value={photo ? undefined : draft.avatar}
            onChange={(v) => {
              setPhoto(undefined);
              set("avatar", v);
            }}
          />
          <div className="grid gap-4 sm:grid-cols-3">
            <div data-field="birthDate">
              <DateField
                label={t("members.form.birthDate")}
                optional
                max={today}
                value={draft.birthDate}
                onChange={(e) => set("birthDate", e.target.value)}
                error={errorText(errors.birthDate)}
              />
            </div>
            <div data-field="phone">
              <TextField
                label={t("members.form.phone")}
                optional
                type="tel"
                inputMode="tel"
                autoComplete="off"
                placeholder={t("members.form.phonePlaceholder")}
                value={draft.phone}
                onChange={(e) => set("phone", e.target.value)}
                error={errorText(errors.phone)}
              />
            </div>
            <div data-field="email">
              <TextField
                label={t("members.form.email")}
                optional
                type="email"
                autoComplete="off"
                placeholder={t("members.form.emailPlaceholder")}
                value={draft.email}
                onChange={(e) => set("email", e.target.value)}
                error={errorText(errors.email)}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <PhotoDrop previewUrl={photo?.url} error={photoError} busy={photoBusy} onFile={onPhoto} onClear={() => setPhoto(undefined)} />
            <div className="flex flex-col gap-2">
              <Checkbox checked={false} onCheckedChange={() => undefined} disabled label={t("members.form.inviteSms")} />
              <Checkbox checked={false} onCheckedChange={() => undefined} disabled label={t("members.form.inviteEmail")} />
              <p className="text-xs text-muted">{t("members.form.inviteNeedsSharing")}</p>
            </div>
          </div>
          <div data-field="interests">
            <InterestsField value={draft.interests} onChange={(v) => set("interests", v)} error={errorText(errors.interests)} />
          </div>
          <div data-field="note">
            <TextArea
              label={t("members.form.note")}
              optional
              maxLength={500}
              placeholder={t("members.form.notePlaceholder")}
              value={draft.note}
              onChange={(e) => set("note", e.target.value)}
              error={errorText(errors.note)}
            />
          </div>
          <p className="text-xs text-muted">{t("members.form.privateHint")}</p>
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
            {existing && existing.status === "ACTIVE" ? (
              <Button
                variant="ghost"
                icon={<Archive aria-hidden className="size-4" />}
                onClick={onArchive}
                className="mr-auto"
                title={t("members.archiveHint")}
              >
                {t("members.archive")}
              </Button>
            ) : null}
            <Link href="/thanh-vien/" className={buttonClass("secondary", "md")}>
              {t("common.cancel")}
            </Link>
            <Button type="submit" loading={submitting}>
              {t(existing ? "members.form.submitEdit" : "members.form.submitAdd")}
            </Button>
          </div>
        </Card>
      </form>
      <aside className="flex min-w-0 flex-col gap-5">
        <MemberPreview draft={draft} photoUrl={photo?.url} today={today} isNew={!existing} />
        <InviteStepsPanel />
      </aside>
    </div>
  );
}
