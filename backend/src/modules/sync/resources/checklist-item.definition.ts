import { int, text } from '../fields';
import { itemChildRules } from '../record-access';
import { TableResource } from '../resource-definition';
import { itemIdField, itemRef } from './shared';

export const checklistItemDefinition = new TableResource({
  type: 'checklist_item',
  table: 'checklist_items',
  access: itemChildRules(),
  parentItemColumn: 'item_id',
  immutable: ['itemId'],
  fields: [
    itemIdField,
    { key: 'text', column: 'text', codec: text(200) },
    { key: 'position', column: 'position', codec: int(0, 10_000) },
  ],
  refs: [itemRef],
});
