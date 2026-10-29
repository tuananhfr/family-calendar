import { hasLevel, type AccessContext } from "@/core/access/evaluate";
import { db } from "@/core/db/db";
import { spaceSchema, type Space } from "@/core/model/space";
import { saveResource } from "@/core/repo/write";

export async function saveSpaceSettings(space: Space, input: Pick<Space, "name" | "timeZone" | "settings">, access: AccessContext): Promise<void> {
  if (!hasLevel(access, "settings", "EDIT") || access.spaceKind !== space.kind || (access.spaceId && access.spaceId !== space.id)) throw new Error("FORBIDDEN");
  const current = await db.spaces.get(space.id);
  if (!current || current.deletedAt) throw new Error("SPACE_NOT_FOUND");
  await saveResource("space_settings", spaceSchema.parse({ ...current, ...input }), "update");
}
