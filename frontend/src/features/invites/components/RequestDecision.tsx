"use client";
import { sharingError } from "@/features/sharing/model/errors";
import { useState } from "react";
import { api } from "@/core/api/client";
import { RELATIONSHIPS } from "@/core/model/common";
import { Button, Select, TextField } from "@/design/components";
import { t } from "@/i18n/vi";
import { useMembers } from "@/features/members/hooks/useMembers";
import { relationshipLabel } from "@/features/members/model/relationship";
import { type JoinRequest, type Role, spaceEndpoint } from "../model/api";
export function RequestDecision({ spaceId, request, roles, onDecided }: { spaceId: string; request: JoinRequest; roles: Role[]; onDecided: () => Promise<unknown> }) {
  const members = useMembers(spaceId);
  const [member, setMember] = useState(request.member_id ?? "new");
  const [name, setName] = useState(request.display_name);
  const [relationship, setRelationship] = useState("OTHER");
  const [profile, setProfile] = useState(request.proposed_profile ?? "PARENT");
  const [role, setRole] = useState(roles.find((r) => r.role_key === "MEMBER")?.role_key ?? roles[0]?.role_key ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const decide = async (approve: boolean) => {
    setBusy(true); setError(undefined);
    try {
      await api("POST", spaceEndpoint(spaceId) + "/join-requests/" + request.request_id + (approve ? "/approve" : "/reject"),
        approve ? { role_key: role, ...(member === "new" ? { new_member: { display_name: name, relationship, profile } } : { member_id: member }) } : undefined);
      await onDecided();
    } catch (err) { setError(sharingError(err)); } finally { setBusy(false); }
  };
  return <div className="flex flex-col gap-3 rounded-control border border-border p-4">
    <div><p className="break-words font-semibold text-text">{request.display_name}</p><p className="text-xs text-muted">{request.device_label ?? "Browser"}</p></div>
    <Select label={t("sharing.member")} value={member} onValueChange={setMember} options={[{ value: "new", label: t("sharing.newMember") }, ...(members ?? []).filter((m) => m.status === "ACTIVE" && !m.linkedActorId).map((m) => ({ value: m.id, label: m.displayName }))]} />
    {member === "new" ? <><TextField label={t("sharing.name")} maxLength={50} required value={name} onChange={(e) => setName(e.target.value)} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Select label={t("sharing.relationship")} value={relationship} onValueChange={setRelationship} options={RELATIONSHIPS.map((r) => ({ value: r, label: relationshipLabel(r) }))} />
        <Select label={t("sharing.profile")} value={profile} onValueChange={setProfile} options={["PARENT", "SENIOR", "CHILD"].map((p) => ({ value: p, label: t("profile." + p) }))} />
      </div></> : null}
    <Select label={t("sharing.role")} value={role} onValueChange={setRole} options={roles.filter((r) => r.role_key !== "OWNER" && r.role_key !== "ORGANIZER").map((r) => ({ value: r.role_key, label: r.name }))} />
    <div className="flex flex-wrap gap-2"><Button loading={busy} disabled={!name.trim() || !role} onClick={() => void decide(true)}>{t("sharing.approve")}</Button><Button variant="secondary" disabled={busy} onClick={() => void decide(false)}>{t("sharing.reject")}</Button></div>
    {error ? <p className="text-sm text-danger" role="alert">{error}</p> : null}
  </div>;
}
