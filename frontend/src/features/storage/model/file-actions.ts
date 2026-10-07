import { db } from "@/core/db/db";
import { getLocalIdentity } from "@/core/db/local-identity";
import { newId } from "@/core/ids";
import type { Folder, StoredFile } from "@/core/model/storage";
import { getActive, listActive } from "@/core/repo/read";
import { deleteResource, RepoError, saveResource } from "@/core/repo/write";
import { normalizeVi } from "@/core/search";

export class FolderError extends Error {
  constructor(readonly code: "REQUIRED" | "DUPLICATE" | "TOO_DEEP" | "SYSTEM" | "NOT_EMPTY") {
    super(code);
    this.name = "FolderError";
  }
}

/** A folder at the top, or one level under a top folder (modules.md §9); a sub-folder keeps its parent's privacy. */
export async function createFolder(spaceId: string, rawName: string, parentId: string | null): Promise<Folder> {
  const name = rawName.trim().slice(0, 100);
  if (!name) throw new FolderError("REQUIRED");
  const space = await db.spaces.get(spaceId);
  if (!space || space.deletedAt !== null) throw new RepoError("SPACE_NOT_FOUND", spaceId);
  const parent = parentId ? await getActive<Folder>("folder", parentId) : undefined;
  if (parentId && (!parent || parent.spaceId !== spaceId)) throw new RepoError("NOT_FOUND", parentId);
  if (parent?.parentId) throw new FolderError("TOO_DEEP");
  const siblings = (await listActive<Folder>("folder", spaceId)).filter((f) => f.parentId === (parentId ?? null));
  if (siblings.some((f) => normalizeVi(f.name) === normalizeVi(name))) throw new FolderError("DUPLICATE");

  const { actorId } = await getLocalIdentity();
  const now = new Date().toISOString();
  return saveResource<Folder>(
    "folder",
    {
      id: newId(),
      spaceId,
      createdByActorId: actorId,
      dataClass: parent?.dataClass ?? "NORMAL",
      sharingScope: parent?.sharingScope ?? (space.kind === "FAMILY" ? "FAMILY_ALL" : "GROUP_MEMBERS"),
      revision: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      syncState: "LOCAL",
      name,
      parentId: parentId ?? null,
      systemKey: null,
    },
    "create",
  );
}

/** System folders never go; others only when empty, so no file is ever lost with its folder. */
export async function deleteFolder(folderId: string): Promise<void> {
  const folder = await getActive<Folder>("folder", folderId);
  if (!folder) throw new RepoError("NOT_FOUND", folderId);
  if (folder.systemKey) throw new FolderError("SYSTEM");
  const hasFiles =
    (await db.files
      .where("folderId")
      .equals(folderId)
      .filter((f) => f.deletedAt === null)
      .count()) > 0;
  const hasChildren =
    (await db.folders
      .where("parentId")
      .equals(folderId)
      .filter((f) => f.deletedAt === null)
      .count()) > 0;
  if (hasFiles || hasChildren) throw new FolderError("NOT_EMPTY");
  await deleteResource("folder", folderId);
}

/** Tombstones the record (it syncs as a delete) and drops the bytes right away to give the space back. */
export async function deleteStoredFile(fileId: string): Promise<StoredFile | undefined> {
  const file = await getActive<StoredFile>("file", fileId);
  if (!file) return undefined;
  await deleteResource("file", fileId);
  await db.blobs.where("fileId").equals(fileId).delete();
  return file;
}
