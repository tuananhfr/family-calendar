"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { Plus, Settings, UserRoundPlus, UsersRound } from "lucide-react";
import { db } from "@/core/db/db";
import { hasLevel } from "@/core/access/evaluate";
import type { Space } from "@/core/model/space";
import { AvatarStack, Button, Card, EmptyState, PageHeader, SkeletonList, Tabs, TextField } from "@/design/components";
import { useAccess, useActiveSpace } from "@/features/members";
import { t, vi } from "@/i18n/vi";
import { filteredGroups, GROUP_TYPES } from "../model/groups";
import { GroupEditor } from "./GroupEditor";
import { GroupWorkspace } from "./GroupWorkspace";
import { InvitationInbox } from "./InvitationInbox";
import { memberViewerActor, memberVisibleTo } from "@/features/members/model/member-visibility";

export function GroupsScreen() {
  const router = useRouter();
  const { space, spaces, loading, setActive } = useActiveSpace();
  const access = useAccess();
  const members = useLiveQuery(async () => {
    const rows = await db.members.filter((row) => !row.deletedAt && row.status === "ACTIVE").toArray();
    const actors = new Map(await Promise.all([...new Set(rows.map((member) => member.spaceId))].map(async (id) => [id, await memberViewerActor(id)] as const)));
    return rows.filter((member) => memberVisibleTo(member, actors.get(member.spaceId)));
  }, []);
  const [category, setCategory] = useState("ALL");
  const [query, setQuery] = useState("");
  const [editor, setEditor] = useState<{ space?: Space }>();
  const filtered = filteredGroups(spaces, category, query);
  return <div className="flex flex-col gap-5"><PageHeader title={t("groups.title")} subtitle={t("groups.subtitle")} icon={<UsersRound />} illustration="corner-groups" actions={<Button icon={<Plus aria-hidden className="size-4" />} onClick={() => setEditor({})}>{t("groups.create")}</Button>} />
    <Tabs label={t("groups.title")} value={category} onValueChange={setCategory} items={["ALL", "FAMILY", ...GROUP_TYPES].map((value) => ({ value, label: t(`groups.categories.${value}`) }))} />
    <TextField label={t("groups.search")} value={query} maxLength={100} onChange={(e) => setQuery(e.target.value)} />
    {loading || !members ? <SkeletonList rows={3} /> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {filtered.map((candidate) => {
        const people = members.filter((member) => member.spaceId === candidate.id);
        return <Card key={candidate.id} data-testid="group-card" className="flex flex-col gap-3"><div className="flex items-start justify-between gap-3"><h2 className="min-w-0 break-words text-lg font-bold text-text">{candidate.name}</h2>{candidate.kind === "GROUP" && <Button variant="ghost" size="sm" aria-label={t("groups.settings", { name: candidate.name })} disabled={candidate.id === space?.id && !!access && !hasLevel(access, "settings", "EDIT")} onClick={() => { setActive(candidate.id); setEditor({ space: candidate }); }}><Settings aria-hidden className="size-4" /></Button>}</div><p className="text-xs font-semibold text-primary">{t(`groups.categories.${candidate.kind === "FAMILY" ? "FAMILY" : candidate.settings.groupType ?? "OTHER"}`)} · {t(candidate.sharingState === "SHARED" ? "dataMode.shared" : "dataMode.local")}</p><p className="break-words text-sm text-body">{candidate.settings.description ?? t("groups.members", { n: people.length })}</p><div className="flex flex-wrap items-center justify-between gap-2"><AvatarStack people={people.map((member) => ({ name: member.displayName }))} /><span className="text-xs text-muted">{t("groups.members", { n: people.length })}</span></div><div className="flex flex-wrap gap-2">{candidate.kind === "FAMILY" && <Button icon={<UserRoundPlus aria-hidden className="size-4" />} onClick={() => { setActive(candidate.id); router.push("/thanh-vien/them/?tab=link"); }}>{t("groups.inviteFamily")}</Button>}<Button variant="secondary" aria-label={t("groups.open", { name: candidate.name })} onClick={() => setActive(candidate.id)}>{t(candidate.id === space?.id ? "groups.current" : "groups.openAction")}</Button></div></Card>;
      })}
      <button type="button" onClick={() => setEditor({})} className="flex min-h-40 items-center justify-center gap-3 rounded-card border-2 border-dashed border-border-strong bg-surface p-5 font-semibold text-primary hover:bg-primary-soft"><Plus aria-hidden className="size-5" />{t("groups.newCard")}</button>
      {!filtered.length && <EmptyState title={t("groups.noGroups")} body={t("groups.noGroupsBody")} />}
    </div>}
    {space?.kind === "GROUP" && <GroupWorkspace key={space.id} space={space} access={access} />}
    <InvitationInbox />
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{vi.groups.commitments.map((commitment) => <li key={commitment} className="rounded-control bg-primary-soft px-4 py-3 text-sm font-semibold text-primary">{commitment}</li>)}</ul>
    {editor && <GroupEditor key={editor.space?.id ?? "new"} space={editor.space} access={space?.id === editor.space?.id ? access : undefined} onClose={() => setEditor(undefined)} onSaved={(id) => { setActive(id); setEditor(undefined); }} />}
  </div>;
}
