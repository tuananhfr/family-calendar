import { accessContextFor, type AccessContext } from "../access/evaluate";
import { db } from "../db/db";
import { getLocalIdentity } from "../db/local-identity";
import { newId } from "../ids";
import type { ItemExceptionRecord } from "../model/occurrence";
import type { Folder, StoredFile } from "../model/storage";
import { occurrenceKey } from "../recurrence/occurrence-key";
import { createLocalSpace, saveResource } from "../repo/write";
import { makeItem, makeMember, makeRule, makeState } from "./items";
import { baseFields } from "./records";

export const SECRET_SETTING_VALUE = "SECRET-COOKIE-VALUE-123";
export const OUTBOX_MARKER = "OUTBOX-MARKER-OP";

export interface SeededSpace {
  spaceId: string;
  actorId: string;
  deviceId: string;
  actor: AccessContext;
  ids: {
    recurring: string;
    privateMine: string;
    privateOther: string;
    medication: string;
    voice: string;
    audioBlob: string;
    file: string;
    fileBlob: string;
    activeSos: string;
  };
}

/** A local family Space with every kind of data a backup has to carry (and some it must not). */
export async function seedBackupSpace(): Promise<SeededSpace> {
  const { actorId, deviceId } = await getLocalIdentity();
  const spaceId = await createLocalSpace({ kind: "FAMILY", name: "Nhà Minh", timeZone: "Asia/Ho_Chi_Minh" });
  const mine = { spaceId, createdByActorId: actorId };

  const dad = await saveResource("member", makeMember("Bố", { ...baseFields(mine), linkedActorId: actorId }), "create");
  const son = await saveResource("member", makeMember("Bin", { ...baseFields(mine), profile: "CHILD", relationship: "SON" }), "create");

  const recurring = await saveResource(
    "item",
    makeItem({
      ...baseFields(mine),
      title: "Đưa bé đi học",
      memberIds: [son.id],
      schedule: { allDay: false, start: "2026-10-05T07:00", end: "2026-10-05T07:30", timeZone: "Asia/Ho_Chi_Minh", rrule: "FREQ=WEEKLY;BYDAY=MO,WE,FR" },
    }),
    "create",
  );
  await saveResource("reminder_rule", makeRule(recurring, { ...baseFields(mine), offsetsMinutes: [15] }), "create");
  const cancel: ItemExceptionRecord = {
    ...baseFields(mine),
    itemId: recurring.id,
    occurrenceKey: occurrenceKey(recurring.id, "2026-10-07T07:00"),
    kind: "CANCEL",
  };
  await saveResource("item_exception", cancel, "create");
  await saveResource("occurrence_state", makeState(recurring, "2026-10-05T07:00", "DONE", { ...baseFields(mine), actedByActorId: actorId }), "create");

  const privateMine = await saveResource("item", makeItem({ ...baseFields({ ...mine, sharingScope: "PRIVATE" }), title: "Quà sinh nhật vợ" }), "create");
  const privateOther = await saveResource(
    "item",
    makeItem({ ...baseFields({ spaceId, sharingScope: "PRIVATE" }), title: "Bí mật của người khác" }),
    "create",
  );
  const medication = await saveResource(
    "item",
    makeItem({
      ...baseFields({ ...mine, dataClass: "SENSITIVE" }),
      kind: "REMINDER",
      preset: "MEDICATION",
      category: "HEALTH",
      title: "Thuốc huyết áp",
      memberIds: [dad.id],
      schedule: { allDay: false, start: "2026-10-01T07:00", timeZone: "Asia/Ho_Chi_Minh", rrule: "FREQ=DAILY" },
    }),
    "create",
  );

  const audioBlob = newId();
  await db.blobs.add({ id: audioBlob, kind: "AUDIO", mime: "audio/webm", size: 4, data: new Blob([new Uint8Array([1, 2, 3, 4])], { type: "audio/webm" }), createdAt: "2026-10-06T00:00:00.000Z" });
  const voice = await saveResource("item", makeItem({ ...baseFields(mine), kind: "REMINDER", preset: "OTHER", title: "Lời nhắn của mẹ", audioAssetId: audioBlob }), "create");

  const folder: Folder = { ...baseFields(mine), name: "Giấy tờ", parentId: null, systemKey: "DOCUMENTS" };
  await saveResource("folder", folder, "create");
  const fileBlob = newId();
  const fileId = newId();
  const bytes = new TextEncoder().encode("%PDF-1.4 hello");
  await db.blobs.add({ id: fileBlob, fileId, kind: "FILE", mime: "application/pdf", size: bytes.length, data: new Blob([bytes], { type: "application/pdf" }), createdAt: "2026-10-06T00:00:00.000Z" });
  const file: StoredFile = {
    ...baseFields(mine),
    id: fileId,
    folderId: folder.id,
    name: "so-ho-khau.pdf",
    mime: "application/pdf",
    size: bytes.length,
    sha256: "0".repeat(64),
    kind: "DOCUMENT",
    blobState: "LOCAL_ONLY",
  };
  await saveResource("file", file, "create");

  await db.settings.put({ key: "notifications.showDetails", value: false });
  await db.settings.put({ key: "auth.sessionToken", value: SECRET_SETTING_VALUE });
  await db.outbox.add({
    operationId: OUTBOX_MARKER,
    spaceId,
    resourceType: "item",
    resourceId: recurring.id,
    action: "update",
    baseRevision: null,
    payload: null,
    clientCreatedAt: "2026-10-06T00:00:00.000Z",
    schemaVersion: 1,
    state: "QUEUED",
    attempts: 0,
    nextAttemptAt: null,
    priority: 0,
  });
  const activeSos = newId();
  await db.emergencyEvents.add({ id: activeSos, spaceId, createdAt: "2026-10-06T00:00:00.000Z", status: "ACTIVE" });
  await db.emergencyContacts.add({ id: newId(), spaceId, name: "Bác Hai", phone: "0901234567" });

  const actor = accessContextFor("OWNER", { actorId, representedMemberIds: [dad.id], representedProfiles: ["PARENT"], spaceKind: "FAMILY" });
  return {
    spaceId,
    actorId,
    deviceId,
    actor,
    ids: {
      recurring: recurring.id,
      privateMine: privateMine.id,
      privateOther: privateOther.id,
      medication: medication.id,
      voice: voice.id,
      audioBlob,
      file: fileId,
      fileBlob,
      activeSos,
    },
  };
}

/** Every store a restore may touch, as plain rows (blobs as bytes) for deep comparison. */
export async function snapshotDb(): Promise<Record<string, unknown[]>> {
  const out: Record<string, unknown[]> = {};
  for (const table of db.tables) {
    const rows = await table.toArray();
    out[table.name] = await Promise.all(
      rows.map(async (r: Record<string, unknown>) =>
        r.data instanceof Blob ? { ...r, data: Array.from(new Uint8Array(await r.data.arrayBuffer())) } : r,
      ),
    );
    out[table.name].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  }
  return out;
}
