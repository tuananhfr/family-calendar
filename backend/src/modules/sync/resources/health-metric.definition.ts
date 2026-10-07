import { decimal, id, localDateTime, oneOf, text } from '../fields';
import { capabilityRules } from '../record-access';
import { TableResource } from '../resource-definition';

const VALUE_LIMIT = 999_999_999;

export const healthMetricDefinition = new TableResource({
  type: 'health_metric',
  table: 'health_metrics',
  access: capabilityRules('health', { memberColumn: 'member_id' }),
  fields: [
    { key: 'memberId', column: 'member_id', codec: id },
    {
      key: 'type',
      column: 'type',
      codec: oneOf([
        'WEIGHT',
        'HEIGHT',
        'BLOOD_PRESSURE',
        'HEART_RATE',
        'SLEEP',
        'BLOOD_GLUCOSE',
        'TEMPERATURE',
        'CUSTOM',
      ] as const),
    },
    { key: 'value', column: 'value', codec: decimal(-VALUE_LIMIT, VALUE_LIMIT, 3) },
    { key: 'value2', column: 'value2', codec: decimal(-VALUE_LIMIT, VALUE_LIMIT, 3), optional: true },
    { key: 'unit', column: 'unit', codec: text(20), optional: true },
    { key: 'customName', column: 'custom_name', codec: text(50), optional: true },
    { key: 'measuredAt', column: 'measured_at', codec: localDateTime },
    { key: 'note', column: 'note', codec: text(500, 0), optional: true },
  ],
  refs: [{ key: 'memberId', table: 'members' }],
  validate(_input, columns, e) {
    if (columns.type === 'BLOOD_PRESSURE' && columns.value2 === null) e.add('value2', 'SECOND_VALUE_REQUIRED');
    if (columns.type === 'CUSTOM' && !columns.unit) e.add('unit', 'UNIT_REQUIRED');
    if (columns.type === 'CUSTOM' && !columns.custom_name) e.add('customName', 'NAME_REQUIRED');
  },
});
