import { db } from "../db/db";
export async function mediaKeys(spaceId: string) {
  const [members, items, rules, files] = await Promise.all([
    db.members.where("spaceId").equals(spaceId).toArray(), db.items.where("spaceId").equals(spaceId).toArray(),
    db.reminderRules.where("spaceId").equals(spaceId).toArray(), db.files.where("spaceId").equals(spaceId).toArray()]);
  const keys: string[] = [];
  const prefix = "media:" + spaceId + "/";
  for (const row of members) if (!row.deletedAt && row.avatar?.startsWith("blob:")) keys.push(prefix + "member/" + row.id + "/" + row.avatar.slice(5));
  for (const row of items) if (!row.deletedAt && row.audioAssetId) keys.push(prefix + "item/" + row.id + "/" + row.audioAssetId);
  for (const row of rules) if (!row.deletedAt && row.audioAssetId) keys.push(prefix + "reminder/" + row.id + "/" + row.audioAssetId);
  for (const row of files) if (!row.deletedAt) keys.push(prefix + "file/" + row.id + "/" + row.id);
  return keys;
}
export async function readMediaStatus(spaceId: string) {
  const rows = await db.settings.bulkGet(await mediaKeys(spaceId));
  let pending = 0, excluded = 0;
  for (const row of rows) {
    const state = (row?.value as { state?: string } | undefined)?.state;
    if (state === "EXCLUDED") excluded++;
    else if (state !== "DONE") pending++;
  }
  return { pending, excluded };
}
