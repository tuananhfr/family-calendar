import { id, localDate, text } from '../fields';
import { capabilityRules } from '../record-access';
import { TableResource } from '../resource-definition';

export const healthNoteDefinition = new TableResource({
  type: 'health_note',
  table: 'health_notes',
  access: capabilityRules('health', { memberColumn: 'member_id' }),
  fields: [
    { key: 'memberId', column: 'member_id', codec: id },
    { key: 'date', column: 'date', codec: localDate },
    { key: 'title', column: 'title', codec: text(200) },
    { key: 'body', column: 'body', codec: text(5000, 0) },
  ],
  refs: [{ key: 'memberId', table: 'members' }],
});
