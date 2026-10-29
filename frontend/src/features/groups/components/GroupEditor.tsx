"use client";
import { useState } from "react";
import type { Space } from "@/core/model/space";
import type { AccessContext } from "@/core/access/evaluate";
import { Button, Dialog, Select, TextArea, TextField } from "@/design/components";
import { createGroup, GROUP_TYPES, updateGroup, type GroupType } from "../model/groups";
import { t } from "@/i18n/vi";

export function GroupEditor({ space, access, onClose, onSaved }: { space?: Space; access?: AccessContext; onClose(): void; onSaved(id: string): void }) {
  const [name, setName] = useState(space?.name ?? "");
  const [description, setDescription] = useState(space?.settings.description ?? "");
  const [groupType, setGroupType] = useState<GroupType>(space?.settings.groupType ?? "OTHER");
  const [selfName, setSelfName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  return <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }} title={t(space ? "groups.edit" : "groups.createTitle")} size="md">
    <form className="flex flex-col gap-4" onSubmit={async (e) => {
      e.preventDefault(); setBusy(true); setError(false);
      try {
        if (space) { if (!access) throw new Error("FORBIDDEN"); await updateGroup(space, { name, description, groupType }, access); onSaved(space.id); }
        else onSaved(await createGroup({ name, description, groupType, selfName }));
      } catch { setError(true); } finally { setBusy(false); }
    }}>
      {!space && <p className="text-sm text-body">{t("groups.localHelp")}</p>}
      <TextField label={t("groups.name")} required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} />
      <Select label={t("groups.type")} value={groupType} onValueChange={(value) => setGroupType(value as GroupType)} options={GROUP_TYPES.map((value) => ({ value, label: t(`groups.categories.${value}`) }))} />
      <TextArea label={t("groups.description")} optional maxLength={200} value={description} onChange={(e) => setDescription(e.target.value)} />
      {!space && <TextField label={t("groups.selfName")} required maxLength={50} value={selfName} onChange={(e) => setSelfName(e.target.value)} />}
      {error && <p role="alert" className="text-sm text-danger">{t("groups.error")}</p>}
      <div className="flex flex-wrap justify-end gap-2"><Button variant="secondary" disabled={busy} onClick={onClose}>{t("common.cancel")}</Button><Button type="submit" loading={busy} disabled={!name.trim() || (!space && !selfName.trim()) || (!!space && (!access || access.spaceKind !== "GROUP"))}>{t("groups.save")}</Button></div>
    </form>
  </Dialog>;
}
