import { isLocalDate } from '../../../common/time/local-date';
import { isLocalDateTime } from '../../../common/time/zoned';
import { isPlainObject, jsonObject, oneOf } from '../fields';
import { itemChildRules } from '../record-access';
import { TableResource } from '../resource-definition';
import { itemIdField, itemRef, occurrenceKeyCodec } from './shared';

const override = jsonObject((v, path, e) => {
  if (!isPlainObject(v)) return e.add(path, 'INVALID');
  const allowed = new Set(['start', 'end', 'allDay', 'title']);
  if (Object.keys(v).some((k) => !allowed.has(k))) return e.add(path, 'UNKNOWN_FIELD');
  const wall = (x: unknown) => x === undefined || isLocalDate(x) || isLocalDateTime(x);
  if (!wall(v.start)) return e.add(`${path}.start`, 'SCHEDULE_SHAPE');
  if (!wall(v.end)) return e.add(`${path}.end`, 'SCHEDULE_SHAPE');
  if (v.allDay !== undefined && typeof v.allDay !== 'boolean') return e.add(`${path}.allDay`, 'INVALID');
  if (v.title !== undefined) {
    if (typeof v.title !== 'string' || v.title.trim().length === 0) return e.add(`${path}.title`, 'REQUIRED');
    if ([...v.title.trim()].length > 200) return e.add(`${path}.title`, 'TOO_LONG');
    return { ...v, title: v.title.trim() };
  }
  return v;
});

export const itemExceptionDefinition = new TableResource({
  type: 'item_exception',
  table: 'item_exceptions',
  access: itemChildRules(),
  parentItemColumn: 'item_id',
  immutable: ['itemId'],
  fields: [
    { key: 'itemId', column: 'item_id', codec: itemIdField.codec },
    { key: 'occurrenceKey', column: 'occurrence_key', codec: occurrenceKeyCodec },
    { key: 'kind', column: 'kind', codec: oneOf(['CANCEL', 'OVERRIDE'] as const) },
    { key: 'override', column: 'override_data', codec: override, optional: true },
  ],
  refs: [itemRef],
  validate(_input, columns, e) {
    if (columns.kind === 'OVERRIDE' && columns.override_data === null) e.add('override', 'OVERRIDE_REQUIRED');
  },
});
