import { bool, id } from '../fields';
import { itemChildRules } from '../record-access';
import { TableResource } from '../resource-definition';
import { itemIdField, itemRef, occurrenceKeyCodec } from './shared';

/** Tick of one checklist line for one occurrence; `occurrence_action` upserts by (line, occurrence key). */
export const checklistStateDefinition = new TableResource({
  type: 'checklist_state',
  table: 'checklist_states',
  actions: ['create', 'update', 'delete', 'occurrence_action'],
  access: itemChildRules(),
  parentItemColumn: 'item_id',
  naturalKey: ['checklist_item_id', 'occurrence_key'],
  immutable: ['itemId', 'checklistItemId', 'occurrenceKey'],
  fields: [
    itemIdField,
    { key: 'checklistItemId', column: 'checklist_item_id', codec: id },
    { key: 'occurrenceKey', column: 'occurrence_key', codec: occurrenceKeyCodec },
    { key: 'checked', column: 'checked', codec: bool },
  ],
  refs: [
    itemRef,
    {
      key: 'checklistItemId',
      table: 'checklist_items',
      check: (ref, columns) => (ref.item_id === columns.item_id ? null : 'NOT_IN_ITEM'),
    },
  ],
  sameOutcome: (row, draft) => row.deleted_at === null && Number(row.checked) === draft.columns.checked,
});
