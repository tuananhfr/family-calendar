import { canReadItem, type AccessContext } from "@/core/access/evaluate";
import { exportIcs } from "@/core/ics/export";
import type { Item } from "@/core/model/item";
import type { ItemExceptionRecord } from "@/core/model/occurrence";
import { listActive } from "@/core/repo/read";

/** ICS of what this person may see in the Space; exportIcs then drops PRIVATE and SENSITIVE on its own. */
export async function buildSpaceIcs(spaceId: string, actor: AccessContext, calendarName: string, now: Date = new Date()): Promise<{ ics: string; events: number }> {
  const items = (await listActive<Item>("item", spaceId)).filter((i) => canReadItem(actor, i));
  const exceptions = await listActive<ItemExceptionRecord>("item_exception", spaceId);
  const ics = exportIcs(items, exceptions, { calendarName, now });
  return { ics, events: ics.match(/^BEGIN:VEVENT$/gm)?.length ?? 0 };
}

export function icsFileName(today: string): string {
  return `lich-gia-dinh-${today}.ics`;
}
