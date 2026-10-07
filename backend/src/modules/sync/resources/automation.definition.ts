import { AUTOMATION_RULES } from '../domain-enums';
import { bool, isPlainObject, jsonObject, oneOf } from '../fields';
import { capabilityRules } from '../record-access';
import { TableResource } from '../resource-definition';

const params = jsonObject((v, path, e) => {
  if (!isPlainObject(v)) return e.add(path, 'INVALID');
  const entries = Object.entries(v);
  if (entries.length > 20) return e.add(path, 'TOO_MANY');
  for (const [key, value] of entries) {
    if (key.length > 40) return e.add(`${path}.${key}`, 'TOO_LONG');
    const ok =
      typeof value === 'boolean' ||
      (typeof value === 'number' && Number.isFinite(value)) ||
      (typeof value === 'string' && value.length <= 100);
    if (!ok) return e.add(`${path}.${key}`, 'INVALID');
  }
  return v;
});

/** Fixed if-then rules (modules.md §11); `lastRunAt` is written by the worker only. */
export const automationDefinition = new TableResource({
  type: 'automation',
  table: 'automations',
  access: capabilityRules('ai'),
  ignoredKeys: ['lastRunAt'],
  fields: [
    { key: 'ruleKey', column: 'rule_key', codec: oneOf(AUTOMATION_RULES) },
    { key: 'enabled', column: 'enabled', codec: bool },
    { key: 'params', column: 'params', codec: params },
  ],
  extraWire: (row) => ({
    lastRunAt: row.last_run_at ? new Date(row.last_run_at as string | Date).toISOString() : null,
  }),
});
