import { db } from "@/core/db/db";
import type { Member } from "@/core/model/member";
import type { OnlineIdentity } from "@/core/db/online-identity";

export async function memberViewerActor(spaceId: string): Promise<string | undefined> {
  const space = await db.spaces.get(spaceId);
  if (!space || space.deletedAt) return undefined;
  return space.sharingState === "SHARED" ? ((await db.settings.get("online.identity"))?.value as OnlineIdentity | undefined)?.actorId : (await db.localIdentity.get("self"))?.actorId;
}

export function memberVisibleTo(member: Member, actorId: string | undefined): boolean {
  return member.sharingScope !== "PRIVATE" || member.createdByActorId === actorId;
}
