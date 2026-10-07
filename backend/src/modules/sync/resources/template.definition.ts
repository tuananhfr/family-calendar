import { ALL_PRESETS, CATEGORIES, ITEM_KINDS, isPresetOfKind } from '../domain-enums';
import { int, jsonArray, oneOf, text } from '../fields';
import { templateRules } from '../record-access';
import { TableResource } from '../resource-definition';

/** User-saved plan template (system templates are static JSON in the frontend). */
export const templateDefinition = new TableResource({
  type: 'template',
  table: 'templates',
  access: templateRules(),
  fields: [
    { key: 'kind', column: 'kind', codec: oneOf(ITEM_KINDS) },
    { key: 'preset', column: 'preset', codec: oneOf(ALL_PRESETS) },
    { key: 'category', column: 'category', codec: oneOf(CATEGORIES) },
    { key: 'title', column: 'title', codec: text(200) },
    { key: 'durationMinutes', column: 'duration_minutes', codec: int(0, 7 * 24 * 60), optional: true },
    { key: 'checklist', column: 'checklist', codec: jsonArray(text(200), { max: 50 }) },
    {
      key: 'reminderOffsetsMinutes',
      column: 'reminder_offsets_minutes',
      codec: jsonArray(int(0, 366 * 24 * 60), { max: 10 }),
    },
    { key: 'note', column: 'note', codec: text(2000, 0), optional: true },
  ],
  validate(_input, columns, e) {
    if (!isPresetOfKind(columns.kind as string, columns.preset as string)) e.add('preset', 'PRESET_NOT_IN_KIND');
  },
});
