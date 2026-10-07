import { isLocalDate } from '../../../common/time/local-date';
import { isLocalDateTime } from '../../../common/time/zoned';
import { parseRrule } from '../../calendar/recurrence/expand';
import { toFloating } from '../../calendar/recurrence/floating';
import { validateLunarRule } from '../../calendar/recurrence/lunar-rule';
import type { LunarRule } from '../../calendar/recurrence/types';
import { ALL_PRESETS, CATEGORIES, ITEM_KINDS, PRIORITIES, isPresetOfKind } from '../domain-enums';
import {
  bool,
  id,
  instant,
  isPlainObject,
  jsonArray,
  jsonObject,
  money,
  oneOf,
  plain,
  text,
  timeZone,
  type Codec,
} from '../fields';
import { itemRules } from '../record-access';
import { TableResource } from '../resource-definition';
import { memberIdsChild } from './shared';

/** 'YYYY-MM-DD' or 'YYYY-MM-DDTHH:mm'; which one is allowed depends on schedule.allDay (checked in validate). */
const wallTime: Codec<string> = {
  parse(v, path, e) {
    return isLocalDate(v) || isLocalDateTime(v) ? v : e.add(path, 'SCHEDULE_SHAPE');
  },
  out: (raw) => raw,
};

const lunarRule = jsonObject((v, path, e) => {
  if (!isPlainObject(v)) return e.add(path, 'LUNAR_RULE_INVALID');
  const allowed = new Set(['freq', 'day', 'month', 'includeLeap', 'until']);
  if (Object.keys(v).some((k) => !allowed.has(k))) return e.add(path, 'LUNAR_RULE_INVALID');
  if ((v.freq !== 'YEARLY' && v.freq !== 'MONTHLY') || typeof v.includeLeap !== 'boolean') {
    return e.add(path, 'LUNAR_RULE_INVALID');
  }
  if (v.until !== undefined && !isLocalDate(v.until)) return e.add(path, 'LUNAR_RULE_INVALID');
  try {
    validateLunarRule(v as unknown as LunarRule);
  } catch {
    return e.add(path, 'LUNAR_RULE_INVALID');
  }
  return v;
});

export const itemDefinition = new TableResource({
  type: 'item',
  table: 'items',
  access: itemRules,
  fields: [
    { key: 'kind', column: 'kind', codec: oneOf(ITEM_KINDS) },
    { key: 'preset', column: 'preset', codec: oneOf(ALL_PRESETS) },
    { key: 'title', column: 'title', codec: text(200) },
    { key: 'schedule.allDay', column: 'all_day', codec: bool },
    { key: 'schedule.start', column: 'start_local', codec: wallTime },
    { key: 'schedule.end', column: 'end_local', codec: wallTime, optional: true },
    { key: 'schedule.timeZone', column: 'time_zone', codec: timeZone },
    { key: 'schedule.rrule', column: 'rrule', codec: plain(500, 1), optional: true },
    { key: 'schedule.lunarRule', column: 'lunar_rule', codec: lunarRule, optional: true },
    { key: 'responsibleMemberId', column: 'responsible_member_id', codec: id, nullable: true },
    { key: 'category', column: 'category', codec: oneOf(CATEGORIES) },
    { key: 'priority', column: 'priority', codec: oneOf(PRIORITIES) },
    { key: 'note', column: 'note', codec: text(2000, 0), optional: true },
    { key: 'locationText', column: 'location_text', codec: text(200, 0), optional: true },
    { key: 'attachments', column: 'attachments', codec: jsonArray(id, { max: 20, unique: true }) },
    { key: 'showOnCalendar', column: 'show_on_calendar', codec: bool },
    { key: 'calendarSystem', column: 'calendar_system', codec: oneOf(['SOLAR', 'LUNAR'] as const) },
    { key: 'templateKey', column: 'template_key', codec: plain(100), optional: true },
    { key: 'completedAt', column: 'completed_at', codec: instant, nullable: true },
    { key: 'amount', column: 'amount', codec: money({ positive: false }), optional: true },
    { key: 'currency', column: 'currency', codec: oneOf(['VND'] as const), optional: true },
    { key: 'documentType', column: 'document_type', codec: text(100, 0), optional: true },
    { key: 'subject', column: 'subject', codec: text(100, 0), optional: true },
    { key: 'teacher', column: 'teacher', codec: text(100, 0), optional: true },
    { key: 'room', column: 'room', codec: text(50, 0), optional: true },
    { key: 'audioAssetId', column: 'audio_asset_id', codec: id, optional: true },
    { key: 'soundKey', column: 'sound_key', codec: plain(50), optional: true },
    { key: 'sourceReference', column: 'source_reference', codec: plain(200), optional: true },
  ],
  children: [memberIdsChild('item_members', 'item_id')],
  refs: [
    { key: 'memberIds', table: 'members', many: true },
    { key: 'responsibleMemberId', table: 'members' },
    { key: 'attachments', table: 'files', many: true },
  ],
  validate(_input, columns, e) {
    if (!isPresetOfKind(columns.kind as string, columns.preset as string)) e.add('preset', 'PRESET_NOT_IN_KIND');
    const allDay = columns.all_day === 1;
    const shapeOk = allDay ? isLocalDate : isLocalDateTime;
    const start = columns.start_local as string;
    const end = columns.end_local as string | null;
    if (!shapeOk(start) || (end !== null && !shapeOk(end))) {
      e.add('schedule.start', 'SCHEDULE_SHAPE');
      return;
    }
    if (end !== null && end < start) e.add('schedule.end', 'END_BEFORE_START');
    if (columns.rrule) {
      try {
        parseRrule(columns.rrule as string, toFloating(start));
      } catch {
        e.add('schedule.rrule', 'RRULE_INVALID');
      }
    }
    const hasLunar = columns.lunar_rule !== null;
    if (columns.calendar_system === 'LUNAR' && !hasLunar) e.add('schedule.lunarRule', 'LUNAR_RULE_REQUIRED');
    if (columns.calendar_system === 'SOLAR' && hasLunar) e.add('schedule.lunarRule', 'LUNAR_RULE_NOT_ALLOWED');
  },
});
