import { getLocalIdentity } from "@/core/db/local-identity";
import { db } from "@/core/db/db";
import { newId } from "@/core/ids";
import type { DataClass } from "@/core/model/common";
import type { Folder, SystemFolderKey } from "@/core/model/storage";
import { listActive } from "@/core/repo/read";
import { RepoError, saveResource } from "@/core/repo/write";

/** The six folders of IMG-F, created with the Space and never deletable (modules.md §9). */
export const SYSTEM_FOLDERS: ReadonlyArray<{ key: SystemFolderKey; name: string; dataClass: DataClass }> = [
  { key: "PHOTOS", name: "Ảnh gia đình", dataClass: "NORMAL" },
  { key: "DOCUMENTS", name: "Giấy tờ quan trọng", dataClass: "NORMAL" },
  { key: "STUDY", name: "Học tập", dataClass: "NORMAL" },
  // Health papers are sensitive by nature: notifications, ICS/print and other roles treat them so.
  { key: "HEALTH", name: "Sức khỏe", dataClass: "SENSITIVE" },
  { key: "VIDEOS", name: "Video kỷ niệm", dataClass: "NORMAL" },
  { key: "OTHER", name: "Khác", dataClass: "NORMAL" },
];

/** Creates whichever system folders the Space is missing; safe to call on every visit. */
export async function ensureSystemFolders(spaceId: string): Promise<Folder[]> {
  const { actorId } = await getLocalIdentity();
  // One rw transaction: two tabs opening Kho together would otherwise both see "missing" and create twelve folders.
  return db.transaction("rw", [db.folders, db.spaces, db.outbox], async () => {
    const space = await db.spaces.get(spaceId);
    if (!space || space.deletedAt !== null) throw new RepoError("SPACE_NOT_FOUND", spaceId);
    const existing = (await listActive<Folder>("folder", spaceId)).filter((f) => f.systemKey);
    const out: Folder[] = [];
    for (const def of SYSTEM_FOLDERS) {
      const found = existing.find((f) => f.systemKey === def.key);
      if (found) {
        out.push(found);
        continue;
      }
      const now = new Date().toISOString();
      const folder: Folder = {
        id: newId(),
        spaceId,
        createdByActorId: actorId,
        dataClass: def.dataClass,
        sharingScope: space.kind === "FAMILY" ? "FAMILY_ALL" : "GROUP_MEMBERS",
        revision: null,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        syncState: "LOCAL",
        name: def.name,
        parentId: null,
        systemKey: def.key,
      };
      out.push(await saveResource("folder", folder, "create"));
    }
    return out;
  });
}
