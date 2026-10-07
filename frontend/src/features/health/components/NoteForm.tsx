"use client";

import { useState } from "react";
import { NotebookPen } from "lucide-react";
import type { Member } from "@/core/model/member";
import type { LocalDate } from "@/core/time/local-date";
import { DateField, Select, TextArea, TextField } from "@/design/components";
import { t } from "@/i18n/vi";
import { saveHealthNote } from "../model/health-writes";
import { HealthFormDialog } from "./HealthFormDialog";

export function NoteForm({ spaceId, members, today, memberId: initialMember, onClose }: { spaceId: string; members: Member[]; today: LocalDate; memberId?: string; onClose: () => void }) {
  const [memberId, setMemberId] = useState(initialMember ?? members[0]?.id ?? "");
  const [date, setDate] = useState(today);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  return (
    <HealthFormDialog
      title={t("health.note.addTitle")}
      icon={<NotebookPen />}
      submitLabel={t("health.note.save")}
      onClose={onClose}
      onSubmit={async () => {
        await saveHealthNote(spaceId, { memberId, date, title, body });
        return t("health.note.saved");
      }}
    >
      {(errors, clear) => (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select
              label={t("health.metrics.member")}
              required
              value={memberId}
              onValueChange={setMemberId}
              options={members.map((m) => ({ value: m.id, label: m.displayName }))}
              error={errors.memberId}
            />
            <DateField label={t("health.note.date")} required value={date} onChange={(e) => setDate(e.target.value)} error={errors.date} />
          </div>
          <TextField
            label={t("health.note.title")}
            required
            autoFocus
            maxLength={200}
            placeholder={t("health.note.titlePlaceholder")}
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              clear("title");
            }}
            error={errors.title}
          />
          <TextArea label={t("health.note.body")} optional maxLength={5000} rows={4} value={body} onChange={(e) => setBody(e.target.value)} error={errors.body} />
        </>
      )}
    </HealthFormDialog>
  );
}
