"use client";
import { useEffect, useState } from "react";
import { api } from "@/core/api/client";
import { Button, Card, Checkbox } from "@/design/components";
import { useMembers } from "@/features/members";
import { t } from "@/i18n/vi";

interface RecipientList { member_ids: string[]; configured: boolean; }

export function EmergencyRecipients({ spaceId, shared, canManage }: { spaceId: string; shared: boolean; canManage: boolean }) {
  const members = useMembers(spaceId)?.filter((member) => member.status === "ACTIVE");
  const [state, setState] = useState<RecipientList>();
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!shared) return;
    let active = true;
    void api<RecipientList>("GET", `/spaces/${spaceId}/emergency-recipients`).then((list) => { if (active) { setState(list); setSelected(list.member_ids); } }).catch(() => { if (active) setMessage(t("emergency.recipientFailed")); });
    return () => { active = false; };
  }, [spaceId, shared]);
  const save = async (ids: string[]) => {
    setBusy(true); setMessage("");
    try { const list = await api<RecipientList>("PUT", `/spaces/${spaceId}/emergency-recipients`, { member_ids: ids }); setState(list); setSelected(list.member_ids); setMessage(t("emergency.recipientsSaved")); }
    catch { setMessage(t("emergency.recipientFailed")); } finally { setBusy(false); }
  };
  return <Card className="flex flex-col gap-3">
    <h2 className="text-lg font-bold text-text">{t("emergency.recipients")}</h2>
    <p className="text-sm text-body">{t("emergency.defaultRecipients")}</p>
    {!shared ? <p className="text-sm text-muted">{t("emergency.needsSharing")}</p> : <>
      {members?.map((member) => <Checkbox key={member.id} label={member.displayName} checked={selected.includes(member.id)} disabled={!canManage || busy || !state} onCheckedChange={(checked) => setSelected((ids) => checked ? [...ids, member.id] : ids.filter((id) => id !== member.id))} />)}
      {canManage && <div className="flex flex-wrap gap-2"><Button disabled={!state} loading={busy} onClick={() => void save(selected)}>{t("emergency.saveRecipients")}</Button><Button variant="secondary" disabled={!state || busy} onClick={() => void save([])}>{t("emergency.resetRecipients")}</Button></div>}
    </>}
    {message && <p role="status" className="text-sm text-body">{message}</p>}
  </Card>;
}
