import { db } from "../db/db";
import { newId } from "../ids";
import { normalizedPhone } from "./phone";
export { normalizedPhone, dialerUrl } from "./phone";

export async function saveEmergencyContact(spaceId: string, name: string, phone: string, country: string): Promise<void> {
  const space = await db.spaces.get(spaceId);
  const normalized = normalizedPhone(phone);
  if (!space || space.kind !== "FAMILY" || !name.trim() || name.trim().length > 100 || !normalized || !/^[A-Z]{2}$/.test(country)) throw new Error("INVALID_CONTACT");
  await db.emergencyContacts.add({ id: newId(), spaceId, name: name.trim(), phone: normalized, country });
}
