import { db } from "@/core/db/db";
import { getLocalIdentity } from "@/core/db/local-identity";
import { newId } from "@/core/ids";
import { GROUP_ROLE_KEYS, GROUP_ROLE_MATRIX, GROUP_ROLE_RESTRICTIONS } from "@/core/access/capabilities";
import { hasLevel, type AccessContext } from "@/core/access/evaluate";
import { memberSchema, type Member } from "@/core/model/member";
import { roleSchema } from "@/core/model/role";
import { spaceSchema, type Space } from "@/core/model/space";
import { createLocalSpace, saveResource } from "@/core/repo/write";
import { normalizeVi } from "@/core/search/normalize";
import { t } from "@/i18n/vi";

export const GROUP_TYPES = ["CLASS", "RELATIVES", "ACTIVITY", "OTHER"] as const;
export type GroupType = (typeof GROUP_TYPES)[number];
export interface GroupInput { name: string; description: string; groupType: GroupType; selfName: string; }

export function filteredGroups(spaces: Space[], category: string, query: string): Space[] {
  const needle = normalizeVi(query);
  return spaces.filter((space) => !space.deletedAt && (category === "ALL" || (space.kind === "FAMILY" ? category === "FAMILY" : (space.settings.groupType ?? "OTHER") === category)) && normalizeVi(`${space.name} ${space.settings.description ?? ""}`).includes(needle));
}

export async function createGroup(input: GroupInput): Promise<string> {
  if (!input.name.trim() || input.name.trim().length > 100 || input.description.length > 200 || !input.selfName.trim() || input.selfName.trim().length > 50 || !GROUP_TYPES.includes(input.groupType)) throw new Error("INVALID_GROUP");
  return db.transaction("rw", [db.spaces, db.members, db.roles, db.localIdentity, db.outbox], async () => {
    const id = await createLocalSpace({ kind: "GROUP", name: input.name });
    const space = (await db.spaces.get(id))!;
    const { actorId } = await getLocalIdentity();
    const base = { spaceId: id, createdByActorId: actorId, dataClass: "NORMAL" as const, sharingScope: "GROUP_MEMBERS" as const, revision: null, createdAt: space.createdAt, updatedAt: space.updatedAt, deletedAt: null, syncState: "LOCAL" as const };
    await db.spaces.put(spaceSchema.parse({ ...space, settings: { ...space.settings, description: input.description.trim() || undefined, groupType: input.groupType } }));
    const member: Member = memberSchema.parse({ ...base, id: newId(), displayName: input.selfName.trim(), relationship: "OTHER", profile: "PARENT", interests: [], status: "ACTIVE", linkedActorId: null });
    await db.members.add(member);
    for (const key of GROUP_ROLE_KEYS) await db.roles.add(roleSchema.parse({ ...base, id: newId(), key, name: t(`groups.roles.${key}`), matrix: GROUP_ROLE_MATRIX[key], restrictions: GROUP_ROLE_RESTRICTIONS[key], system: true }));
    return id;
  });
}

export async function updateGroup(space: Space, input: Omit<GroupInput, "selfName">, access: AccessContext): Promise<void> {
  if (space.kind !== "GROUP" || access.spaceKind !== "GROUP" || (access.spaceId && access.spaceId !== space.id) || !hasLevel(access, "settings", "EDIT")) throw new Error("FORBIDDEN");
  const current = await db.spaces.get(space.id);
  if (!current || current.deletedAt) throw new Error("SPACE_NOT_FOUND");
  const next = spaceSchema.parse({ ...current, name: input.name, settings: { ...current.settings, description: input.description.trim() || undefined, groupType: input.groupType } });
  await saveResource("space_settings", next, "update");
}
