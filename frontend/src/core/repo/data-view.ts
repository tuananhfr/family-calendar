import type { FinanceTxn } from "../model/finance";
import type { HealthNote } from "../model/health";
import type { Item } from "../model/item";
import type { Member } from "../model/member";
import type { ItemExceptionRecord, OccurrenceState } from "../model/occurrence";
import type { ReminderRule } from "../model/reminder-rule";
import type { Space } from "../model/space";
import type { StoredFile } from "../model/storage";
import { getSpace, listActive } from "./read";

/**
 * Live rows of one Space as read from Dexie, before any access filtering. Reports and search take this and filter
 * with the viewer's AccessContext themselves, so a view is never "pre-authorized" by whoever loaded it.
 */
export interface LocalDataView {
  space: Space;
  members: Member[];
  items: Item[];
  exceptions: ItemExceptionRecord[];
  states: OccurrenceState[];
  rules: ReminderRule[];
  files: StoredFile[];
  financeTxns: FinanceTxn[];
  healthNotes: HealthNote[];
}

export async function loadDataView(spaceId: string): Promise<LocalDataView | undefined> {
  const space = await getSpace(spaceId);
  if (!space) return undefined;
  const [members, items, exceptions, states, rules, files, financeTxns, healthNotes] = await Promise.all([
    listActive<Member>("member", spaceId),
    listActive<Item>("item", spaceId),
    listActive<ItemExceptionRecord>("item_exception", spaceId),
    listActive<OccurrenceState>("occurrence_state", spaceId),
    listActive<ReminderRule>("reminder_rule", spaceId),
    listActive<StoredFile>("file", spaceId),
    listActive<FinanceTxn>("finance_txn", spaceId),
    listActive<HealthNote>("health_note", spaceId),
  ]);
  return { space, members, items, exceptions, states, rules, files, financeTxns, healthNotes };
}
