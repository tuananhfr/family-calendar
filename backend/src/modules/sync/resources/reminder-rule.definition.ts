import { CHANNELS, PRIORITIES } from '../domain-enums';
import { bool, id, int, jsonArray, oneOf, plain } from '../fields';
import { itemChildRules } from '../record-access';
import { TableResource } from '../resource-definition';
import { itemIdField, itemRef, memberIdsChild } from './shared';

const MAX_OFFSET_MINUTES = 366 * 24 * 60;

export const reminderRuleDefinition = new TableResource({
  type: 'reminder_rule',
  table: 'reminder_rules',
  access: itemChildRules(),
  parentItemColumn: 'item_id',
  immutable: ['itemId'],
  fields: [
    itemIdField,
    {
      key: 'offsetsMinutes',
      column: 'offsets_minutes',
      codec: jsonArray(int(0, MAX_OFFSET_MINUTES), { max: 10, unique: true }),
    },
    {
      key: 'offsetMonths',
      column: 'offset_months',
      codec: jsonArray(int(1, 24), { max: 5, unique: true }),
      optional: true,
    },
    {
      key: 'channels',
      column: 'channels',
      codec: jsonArray(oneOf(CHANNELS), { max: CHANNELS.length, unique: true, min: 1 }),
    },
    { key: 'priority', column: 'priority', codec: oneOf(PRIORITIES) },
    { key: 'soundKey', column: 'sound_key', codec: plain(50), optional: true },
    { key: 'audioAssetId', column: 'audio_asset_id', codec: id, optional: true },
    { key: 'enabled', column: 'enabled', codec: bool, default: 1 },
  ],
  children: [memberIdsChild('reminder_recipients', 'reminder_rule_id', 'recipientMemberIds')],
  refs: [itemRef, { key: 'recipientMemberIds', table: 'members', many: true }],
  validate(_input, columns, e) {
    const minutes = JSON.parse(columns.offsets_minutes as string) as number[];
    const months = columns.offset_months ? (JSON.parse(columns.offset_months as string) as number[]) : [];
    if (minutes.length === 0 && months.length === 0) e.add('offsetsMinutes', 'OFFSETS_REQUIRED');
  },
});
