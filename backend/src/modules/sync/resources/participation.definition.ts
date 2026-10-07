import { id, oneOf } from '../fields';
import { itemChildRules } from '../record-access';
import { TableResource } from '../resource-definition';
import { itemIdField, itemRef, occurrenceKeyCodec } from './shared';

/** Yes/No/Maybe of a Member; an Actor may answer for Members they represent with only VIEW on the item. */
export const participationDefinition = new TableResource({
  type: 'participation',
  table: 'participations',
  access: itemChildRules({ participation: true }),
  parentItemColumn: 'item_id',
  immutable: ['itemId', 'memberId'],
  fields: [
    itemIdField,
    { key: 'occurrenceKey', column: 'occurrence_key', codec: occurrenceKeyCodec, nullable: true },
    { key: 'memberId', column: 'member_id', codec: id },
    { key: 'response', column: 'response', codec: oneOf(['YES', 'NO', 'MAYBE'] as const) },
  ],
  refs: [itemRef, { key: 'memberId', table: 'members' }],
});
