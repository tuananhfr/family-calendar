"use client";

import type { ReactNode } from "react";
import { FileText } from "lucide-react";
import type { SpaceKind } from "@/core/model/common";
import type { Member } from "@/core/model/member";
import { cn } from "@/design/cn";
import { Button, TextArea, TextField } from "@/design/components";
import { AttachmentPicker } from "@/features/storage";
import { t } from "@/i18n/vi";
import { itemErrorText } from "../model/error-text";
import type { ItemFormValues } from "../model/form-to-item";
import { changeSpecialKind, type ItemType } from "../model/item-types";
import type { TemplateDef } from "../model/templates";
import { AmountField } from "./AmountField";
import { AudioRecorder } from "./AudioRecorder";
import { ChannelPicker } from "./ChannelPicker";
import { ChecklistEditor } from "./ChecklistEditor";
import { MemberMultiPick } from "./MemberMultiPick";
import { OffsetSelect } from "./OffsetSelect";
import { PriorityPicker } from "./PriorityPicker";
import { RepeatPicker } from "./RepeatPicker";
import { ScheduleFields } from "./ScheduleFields";
import { SharingSelect } from "./SharingSelect";
import { SpecialKindPicker } from "./SpecialKindPicker";
import { TemplatePanel } from "./TemplatePanel";

export interface ItemFormProps {
  type: ItemType;
  values: ItemFormValues;
  onChange: (patch: Partial<ItemFormValues>) => void;
  errors: Record<string, string>;
  members: Member[];
  spaceKind: SpaceKind;
  /** Inline template list + toggle; `inlineClassName` hides both where the side panel already lists them. */
  templates?: { open: boolean; onToggle: () => void; onPick: (t: TemplateDef) => void; inlineClassName?: string };
  onLeave: () => void;
}

function Row({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("grid gap-4 md:grid-cols-2", className)}>{children}</div>;
}

export function ItemForm({ type, values, onChange, errors, members, spaceKind, templates, onLeave }: ItemFormProps) {
  const err = (k: string) => itemErrorText(errors[k]);
  const active = members.filter((m) => m.status === "ACTIVE" || values.memberIds.includes(m.id));

  const title = (
    <div data-field="title" data-invalid={errors.title ? "true" : undefined}>
      <TextField
        label={t("items.fields.title")}
        required
        maxLength={200}
        value={values.title}
        placeholder={t(`items.fields.titlePlaceholder.${type}`)}
        onChange={(e) => onChange({ title: e.target.value })}
        error={err("title")}
      />
    </div>
  );
  const description = (
    <div data-field="description" data-invalid={errors.description ? "true" : undefined}>
      <TextArea
        label={t("items.fields.description")}
        optional
        rows={2}
        maxLength={2000}
        value={values.description ?? ""}
        placeholder={t("items.fields.descriptionPlaceholder")}
        onChange={(e) => onChange({ description: e.target.value })}
        error={err("description")}
      />
    </div>
  );
  const memberPick = (
    <MemberMultiPick
      label={t(`items.fields.members.${type}`)}
      required={type === "REMINDER"}
      members={active}
      value={values.memberIds}
      onChange={(memberIds) => onChange({ memberIds })}
      error={err("memberIds")}
      onAddMember={onLeave}
    />
  );
  const repeat = <RepeatPicker special={type === "SPECIAL"} value={values.repeat} onChange={(r) => onChange({ repeat: r })} error={err("repeat")} />;
  const offsets = (
    <OffsetSelect
      offsets={values.reminderOffsets}
      months={values.reminderOffsetMonths}
      allDay={values.allDay}
      onChange={(reminderOffsets) => onChange({ reminderOffsets })}
      error={err("reminderOffsets")}
    />
  );
  const sharing = (
    <Row>
      <SharingSelect value={values.sharingScope} onChange={(sharingScope) => onChange({ sharingScope })} spaceKind={spaceKind} error={err("sharingScope")} />
    </Row>
  );
  const actions = (
    <div className="flex flex-wrap gap-2">
      <AttachmentPicker
        value={values.attachments}
        onChange={(attachments) => onChange({ attachments })}
        imagesOnly={type === "REMINDER"}
        category={values.category}
        label={t(type === "REMINDER" ? "items.actions.attachPhoto" : "items.actions.attachFile")}
      />
      {type === "REMINDER" ? <AudioRecorder value={values.audioAssetId} onChange={(audioAssetId) => onChange({ audioAssetId })} /> : null}
      {templates ? (
        <Button variant="secondary" size="sm" icon={<FileText className="size-4" />} aria-expanded={templates.open} onClick={templates.onToggle} className={templates.inlineClassName}>
          {templates.open ? t("items.actions.hideTemplates") : t(type === "REMINDER" ? "items.actions.template" : "items.actions.templateAdd")}
        </Button>
      ) : null}
    </div>
  );
  const checklist = <ChecklistEditor value={values.checklist} onChange={(checklist) => onChange({ checklist })} error={err("checklist")} />;
  // Events and reminders only show the list once a template filled it; it is saved for every kind.
  const templateChecklist = values.checklist.length > 0 ? checklist : null;
  const templateList = templates?.open ? <TemplatePanel onPick={templates.onPick} className={templates.inlineClassName} /> : null;

  if (type === "REMINDER") {
    const recipients = members.filter((m) => values.memberIds.includes(m.id));
    return (
      <div className="flex flex-col gap-4">
        {title}
        {description}
        {values.preset === "PAYMENT" ? <AmountField value={values.amount} onChange={(amount) => onChange({ amount })} error={err("amount")} /> : null}
        {templateChecklist}
        {actions}
        {templateList}
        <ScheduleFields type={type} values={values} onChange={onChange} errors={errors} />
        <Row>
          {repeat}
          {offsets}
        </Row>
        <Row>
          {memberPick}
          <ChannelPicker value={values.channels} onChange={(channels) => onChange({ channels })} recipients={recipients} error={err("channels")} />
        </Row>
        <Row>
          <PriorityPicker value={values.priority ?? "MEDIUM"} onChange={(priority) => onChange({ priority })} />
          <SharingSelect value={values.sharingScope} onChange={(sharingScope) => onChange({ sharingScope })} spaceKind={spaceKind} error={err("sharingScope")} />
        </Row>
      </div>
    );
  }

  if (type === "TASK") {
    return (
      <div className="flex flex-col gap-4">
        {title}
        <Row>
          <ScheduleFields type={type} values={values} onChange={onChange} errors={errors} />
          {repeat}
        </Row>
        {memberPick}
        <Row>
          <PriorityPicker value={values.priority ?? "MEDIUM"} onChange={(priority) => onChange({ priority })} />
          {values.createReminder ? offsets : null}
        </Row>
        {checklist}
        {description}
        {actions}
        {templateList}
        {sharing}
      </div>
    );
  }

  if (type === "SPECIAL") {
    return (
      <div className="flex flex-col gap-4">
        {title}
        <SpecialKindPicker
          value={values.preset}
          onChange={(p) => {
            const next = changeSpecialKind(values, p);
            onChange({ preset: next.preset, calendarSystem: next.calendarSystem });
          }}
        />
        <ScheduleFields type={type} values={values} onChange={onChange} errors={errors} />
        <Row>
          {repeat}
          {values.createReminder ? offsets : null}
        </Row>
        {memberPick}
        {description}
        {templateChecklist}
        {actions}
        {templateList}
        {sharing}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {title}
      <ScheduleFields type={type} values={values} onChange={onChange} errors={errors} />
      <Row>
        <div data-field="locationText" data-invalid={errors.locationText ? "true" : undefined}>
          <TextField
            label={t("items.fields.location")}
            optional
            maxLength={200}
            value={values.locationText ?? ""}
            placeholder={t("items.fields.locationPlaceholder")}
            onChange={(e) => onChange({ locationText: e.target.value })}
            error={err("locationText")}
          />
        </div>
        {repeat}
      </Row>
      {memberPick}
      {description}
      {templateChecklist}
      {actions}
      {templateList}
      {values.createReminder ? <Row>{offsets}</Row> : null}
      {sharing}
    </div>
  );
}
