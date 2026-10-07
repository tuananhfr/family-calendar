import type { EntityManager } from 'typeorm';
import type { LocalDate } from '../../common/time/local-date';
import { scheduleOf } from '../reminders/scheduler.service';
import type { StoredRow } from '../sync/resource-definition';
import { RESOURCE_REGISTRY } from '../sync/resource-registry';
import { expandOccurrences } from './recurrence/expand';
import type { ItemException, Occurrence } from './recurrence/types';

/**
 * Everything live in one Space that a server-side reader (assistant, automations, ICS feed) looks at. It is
 * unfiltered: each caller applies its own audience rules before anything leaves the server.
 */
export interface SpaceReadView {
  timeZone: string;
  members: StoredRow[];
  items: StoredRow[];
  exceptions: StoredRow[];
  states: StoredRow[];
}

export async function loadSpaceReadView(em: EntityManager, spaceId: string, timeZone: string): Promise<SpaceReadView> {
  return {
    timeZone,
    members: await RESOURCE_REGISTRY.member.listLive(em, spaceId),
    items: await RESOURCE_REGISTRY.item.listLive(em, spaceId),
    exceptions: await RESOURCE_REGISTRY.item_exception.listLive(em, spaceId),
    states: await RESOURCE_REGISTRY.occurrence_state.listLive(em, spaceId),
  };
}

function parseJson<T>(raw: unknown, fallback: T): T {
  if (raw === null || raw === undefined) return fallback;
  if (typeof raw !== 'string') return raw as T;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/**
 * Occurrences of `item` in the window, with canceled and overridden ones applied. Done/skipped ones are dropped
 * unless `includeFinished` (a calendar export still shows what happened).
 */
export function itemOccurrences(
  item: StoredRow,
  data: Pick<SpaceReadView, 'timeZone' | 'exceptions' | 'states'>,
  window: { from: LocalDate; to: LocalDate },
  opts: { includeFinished?: boolean; maxCount?: number } = {},
): Occurrence[] {
  const itemId = item.id as string;
  const exceptions: ItemException[] = data.exceptions
    .filter((e) => e.item_id === itemId && !e.deleted_at)
    .map((e) => ({
      id: String(e.id ?? e.occurrence_key),
      itemId,
      occurrenceKey: e.occurrence_key as string,
      kind: e.kind as 'CANCEL' | 'OVERRIDE',
      ...(e.kind === 'OVERRIDE' ? { override: parseJson(e.override_data, {}) } : {}),
    }));
  const finished = new Set(
    opts.includeFinished
      ? []
      : data.states
          .filter((s) => s.item_id === itemId && !s.deleted_at && (s.status === 'DONE' || s.status === 'SKIPPED'))
          .map((s) => s.occurrence_key as string),
  );
  const schedule = scheduleOf(item);
  try {
    return expandOccurrences(
      itemId,
      { ...schedule, timeZone: schedule.timeZone || data.timeZone },
      window,
      exceptions,
      opts.maxCount,
    ).filter((occ) => !finished.has(occ.occurrenceKey));
  } catch {
    // A row that no longer parses (older schema) is skipped rather than failing the whole read.
    return [];
  }
}
