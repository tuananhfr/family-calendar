import { newId } from "../ids";
import type { Item } from "../model/item";
import type { Member } from "../model/member";
import type { OccurrenceState } from "../model/occurrence";
import type { ReminderRule } from "../model/reminder-rule";
import { occurrenceKey } from "../recurrence/occurrence-key";
import type { Occurrence } from "../recurrence/types";
import { baseFields } from "./records";

/** Schema-valid item for logic tests; start length decides all-day vs timed. */
export function makeItem(overrides: Partial<Item> & { start?: string; end?: string } = {}): Item {
  const { start = "2026-10-06T08:00", end, ...rest } = overrides;
  const schedule = rest.schedule ?? {
    allDay: start.length === 10,
    start,
    ...(end ? { end } : {}),
    timeZone: "Asia/Ho_Chi_Minh",
  };
  return {
    ...baseFields(),
    kind: "EVENT",
    preset: "EVENT",
    title: "Sự kiện",
    memberIds: [],
    category: "FAMILY",
    priority: "MEDIUM",
    attachments: [],
    showOnCalendar: true,
    calendarSystem: "SOLAR",
    ...rest,
    schedule,
  } as Item;
}

export function occurrenceOf(item: Item, start: string = item.schedule.start, end?: string): Occurrence {
  const occ: Occurrence = { itemId: item.id, occurrenceKey: occurrenceKey(item.id, start), start, allDay: start.length === 10, overridden: false };
  if (end) occ.end = end;
  return occ;
}

export function makeState(item: Item, start: string, status: OccurrenceState["status"], overrides: Partial<OccurrenceState> = {}): OccurrenceState {
  return {
    ...baseFields({ spaceId: item.spaceId }),
    itemId: item.id,
    occurrenceKey: occurrenceKey(item.id, start),
    status,
    actedAt: "2026-10-06T00:00:00.000Z",
    actedByActorId: newId(),
    ...overrides,
  } as OccurrenceState;
}

export function makeRule(item: Item, overrides: Partial<ReminderRule> = {}): ReminderRule {
  return {
    ...baseFields({ spaceId: item.spaceId, dataClass: item.dataClass, sharingScope: item.sharingScope }),
    itemId: item.id,
    offsetsMinutes: [0],
    channels: ["IN_APP"],
    priority: "MEDIUM",
    recipientMemberIds: [],
    enabled: true,
    ...overrides,
  } as ReminderRule;
}

export function makeMember(displayName: string, overrides: Partial<Member> = {}): Member {
  return {
    ...baseFields(),
    displayName,
    relationship: "OTHER",
    profile: "PARENT",
    interests: [],
    status: "ACTIVE",
    ...overrides,
  } as Member;
}
