import { makeThumbnail } from "@/features/storage/model/thumbnail";
import { api, apiBlob, ApiRequestError } from "../api/client";
import { db, type BlobRow } from "../db/db";
import { canWrite, canWriteItem, type AccessContext } from "../access/evaluate";
import { withSpaceLock } from "./outbox-processor";
import type { Item } from "../model/item";
import type { BaseRecord } from "./resource-types";
type Reference = { kind: "member" | "item" | "reminder" | "file"; recordId: string; assetId: string; row: BaseRecord; mime?: string; hash?: string; writable: boolean };
export async function sha256(blob: Blob) {
  const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
export async function syncMedia(spaceId: string) {
  return withSpaceLock(spaceId, async () => {
    const space = await db.spaces.get(spaceId), cursor = await db.syncCursors.get(spaceId);
    if (!space || space.sharingState !== "SHARED" || space.deletedAt || cursor?.halt || !cursor?.access) return;
    const access = cursor.access;
    const members = await db.members.where("spaceId").equals(spaceId).filter((m) => !m.deletedAt).toArray();
    const represented = (access.representedMemberIds ?? []) as string[];
    const ctx: AccessContext = { actorId: String(access.actorId), spaceKind: space.kind,
      roleMatrix: access.matrix as AccessContext["roleMatrix"], restrictions: access.restrictions as AccessContext["restrictions"],
      representedMemberIds: represented, representedProfiles: members.filter((m) => represented.includes(m.id)).map((m) => m.profile),
      guardedMemberIds: (access.guardianOfMemberIds ?? []) as string[] };
    const options = (await db.settings.get("media-options:" + spaceId))?.value as { includeFiles: boolean; includeAudio: boolean } | undefined;
    const references: Reference[] = [];
    for (const member of members) if (member.avatar?.startsWith("blob:")) references.push({ kind: "member", recordId: member.id, assetId: member.avatar.slice(5), row: member, writable: canWrite(ctx, member, "members") });
    const items = await db.items.where("spaceId").equals(spaceId).filter((i) => !i.deletedAt).toArray();
    const byId = new Map(items.map((i) => [i.id, i]));
    for (const item of items) if (item.audioAssetId) references.push({ kind: "item", recordId: item.id, assetId: item.audioAssetId, row: item, writable: canWriteItem(ctx, item) });
    for (const rule of await db.reminderRules.where("spaceId").equals(spaceId).filter((r) => !r.deletedAt).toArray()) {
      const item = byId.get(rule.itemId);
      if (rule.audioAssetId && item) references.push({ kind: "reminder", recordId: rule.id, assetId: rule.audioAssetId, row: rule, writable: canWriteItem(ctx, item as Item) });
    }
    for (const file of await db.files.where("spaceId").equals(spaceId).filter((f) => !f.deletedAt).toArray())
      references.push({ kind: "file", recordId: file.id, assetId: file.id, row: file, mime: file.mime, hash: file.sha256, writable: canWrite(ctx, file, "storage") });
    for (const ref of references) {
      if (ref.row.revision === null || ref.row.syncState === "PENDING" || ref.row.syncState === "CONFLICT") continue;
      const key = "media:" + spaceId + "/" + ref.kind + "/" + ref.recordId + "/" + ref.assetId;
      const marker = (await db.settings.get(key))?.value as { state: string; retryAt?: number } | undefined;
      const cached = ref.kind === "file" ? await db.blobs.where("fileId").equals(ref.recordId).filter((b) => b.kind === "FILE").first() : await db.blobs.get(ref.assetId);
      if (cached && ((ref.kind === "file" && options?.includeFiles === false) || (["item", "reminder"].includes(ref.kind) && options?.includeAudio === false))) {
        if (marker?.state !== "EXCLUDED") await db.settings.put({ key, value: { state: "EXCLUDED" } });
        continue;
      }
      if (marker?.state === "DONE" && cached) continue;
      if (marker?.retryAt && marker.retryAt > Date.now()) continue;
      const endpoint = ref.kind === "file" ? "/spaces/" + spaceId + "/files/" + ref.recordId + "/blob"
        : "/spaces/" + spaceId + "/media/" + ref.kind + "/" + ref.recordId + "/" + ref.assetId;
      try {
        if (cached) {
          const hash = ref.hash ?? await sha256(cached.data);
          let exists = false;
          if (ref.kind !== "file") {
            try {
              const info = await api<{ sha256: string }>("GET", endpoint + "/info");
              if (info.sha256 !== hash) throw new Error("MEDIA_CONFLICT");
              exists = true;
            } catch (err) { if (!(err instanceof ApiRequestError && err.status === 404)) throw err; }
          } else exists = (ref.row as BaseRecord & { blobState?: string }).blobState === "SYNCED";
          if (!exists) {
            if (!ref.writable) throw new Error("MEDIA_UNAVAILABLE");
            await api("POST", endpoint, undefined, { raw: cached.data, headers: { "Content-Type": ref.kind === "file" ? "application/octet-stream" : cached.mime, "X-Content-SHA256": hash } });
          }
        } else {
          const data = await apiBlob(endpoint);
          if (ref.hash && await sha256(data) !== ref.hash) throw new Error("MEDIA_CORRUPT");
          const blob: BlobRow = { id: ref.kind === "file" ? crypto.randomUUID() : ref.assetId, ...(ref.kind === "file" ? { fileId: ref.recordId } : {}),
            kind: ref.kind === "member" || ref.kind === "file" ? "FILE" : "AUDIO", data, mime: ref.mime ?? data.type, size: data.size, createdAt: new Date().toISOString() };
          const thumb = ref.kind === "file" && ref.mime?.startsWith("image/") ? await makeThumbnail(data) : null;
          const store = ref.kind === "member" ? "members" : ref.kind === "file" ? "files" : ref.kind === "item" ? "items" : "reminderRules";
          await db.transaction("rw", [store, "blobs", "syncCursors"], async () => {
          const currentAccess = await db.syncCursors.get(spaceId);
          if (currentAccess?.halt || currentAccess?.access?.actorId !== access.actorId || currentAccess?.policyVersion !== cursor.policyVersion) return;
          const latest = await db.table(ref.kind === "member" ? "members" : ref.kind === "file" ? "files" : ref.kind === "item" ? "items" : "reminderRules").get(ref.recordId);
          if (!latest || latest.deletedAt) return;
          if (ref.kind === "member" && latest.avatar !== "blob:" + ref.assetId) return;
          if ((ref.kind === "item" || ref.kind === "reminder") && latest.audioAssetId !== ref.assetId) return;
          await db.blobs.put(blob);
          if (thumb) {
            const id = latest.thumbnailBlobId ?? crypto.randomUUID();
            await db.blobs.put({ id, fileId: ref.recordId, kind: "THUMBNAIL", data: thumb, mime: thumb.type, size: thumb.size, createdAt: new Date().toISOString() });
            await db.files.update(ref.recordId, { thumbnailBlobId: id });
          }
          });
        }
        await db.settings.put({ key, value: { state: "DONE" } });
      } catch (err) {
        await db.settings.put({ key, value: { state: "MISSING", retryAt: Date.now() + 60_000 } });
        if (err instanceof ApiRequestError && ["AUTH_REQUIRED", "SESSION_EXPIRED", "DEVICE_REVOKED", "SPACE_ACCESS_REVOKED"].includes(err.code)) throw err;
      }
    }
  });
}
