import { instant, oneOf } from '../fields';
import { itemChildRules } from '../record-access';
import { TableResource } from '../resource-definition';
import { itemIdField, itemRef, occurrenceKeyCodec } from './shared';

/** DONE / SNOOZED / SKIPPED of one occurrence; `occurrence_action` upserts by (item, occurrence key). */
export const occurrenceStateDefinition = new TableResource({
  type: 'occurrence_state',
  table: 'occurrence_states',
  actions: ['create', 'update', 'delete', 'occurrence_action'],
  access: itemChildRules(),
  parentItemColumn: 'item_id',
  naturalKey: ['item_id', 'occurrence_key'],
  immutable: ['itemId', 'occurrenceKey'],
  // The acting Actor comes from the session, never from the payload.
  ignoredKeys: ['actedByActorId'],
  fields: [
    itemIdField,
    { key: 'occurrenceKey', column: 'occurrence_key', codec: occurrenceKeyCodec },
    { key: 'status', column: 'status', codec: oneOf(['DONE', 'SNOOZED', 'SKIPPED'] as const) },
    { key: 'actedAt', column: 'acted_at', codec: instant },
    { key: 'snoozeUntil', column: 'snooze_until', codec: instant, nullable: true },
  ],
  refs: [itemRef],
  derive: (_columns, ctx) => ({ acted_by_actor_id: ctx.actorId }),
  extraWire: (row) => ({ actedByActorId: row.acted_by_actor_id }),
  // A repeated SNOOZE carries a new snooze time, so it is never a no-op.
  sameOutcome: (row, draft) =>
    row.deleted_at === null && row.status === draft.columns.status && row.status !== 'SNOOZED',
});
