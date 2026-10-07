import { newId } from "../ids";
import { db } from "./db";

/**
 * Stable local Actor and Device ids, created on first use. They become the server identity when the Space is
 * shared, so they are never regenerated (domain-model.md "ID và phiên bản").
 */
export async function getLocalIdentity(): Promise<{ actorId: string; deviceId: string }> {
  // rw transaction serializes concurrent first calls (also across tabs), so only one identity is ever written.
  return db.transaction("rw", db.localIdentity, async () => {
    const existing = await db.localIdentity.get("self");
    if (existing) return { actorId: existing.actorId, deviceId: existing.deviceId };
    const row = { key: "self" as const, actorId: newId(), deviceId: newId(), createdAt: new Date().toISOString() };
    await db.localIdentity.add(row);
    return { actorId: row.actorId, deviceId: row.deviceId };
  });
}
