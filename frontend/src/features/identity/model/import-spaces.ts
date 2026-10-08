import { api } from "@/core/api/client";
import { db } from "@/core/db/db";
import { applySnapshot } from "@/core/sync/snapshot-apply";
import type { SnapshotWire } from "@/core/sync/transport";
import type { Space } from "@/core/model/space";
import { useAppStore } from "@/store/app.store";
export async function importSharedSpaces() {
  const response = await api<{ spaces: Array<{ id: string; sharingState: string }> }>("GET", "/spaces");
  let first: string | undefined;
  for (const space of response.spaces.filter((s) => s.sharingState === "SHARED")) {
    const snapshot = await api<SnapshotWire>("GET", "/spaces/" + space.id + "/sync/snapshot");
    const local = await db.spaces.get(space.id);
    if (local && local.sharingState !== "SHARED") continue;
    await db.spaces.put({ ...(snapshot.space as unknown as Space), id: space.id, spaceId: space.id, sharingState: "SHARED", syncState: "SYNCED", deletedAt: null });
    await applySnapshot(space.id, snapshot);
    first ??= space.id;
  }
  if (first) useAppStore.getState().setActiveSpaceId(first);
}
