// Backend copy of the resource list (modules.md §1); frontend/src/core/sync/resource-types.ts keeps the same list.
export const RESOURCE_TYPES = [
  'space_settings',
  'member',
  'role',
  'item',
  'item_exception',
  'occurrence_state',
  'checklist_item',
  'checklist_state',
  'participation',
  'reminder_rule',
  'finance_account',
  'finance_txn',
  'finance_budget',
  'finance_saving',
  'finance_loan',
  'finance_goal',
  'health_profile',
  'health_metric',
  'health_note',
  'folder',
  'file',
  'automation',
  'template',
] as const;
export type ResourceType = (typeof RESOURCE_TYPES)[number];

export function isResourceType(value: unknown): value is ResourceType {
  return typeof value === 'string' && (RESOURCE_TYPES as readonly string[]).includes(value);
}

export const SYNC_ACTIONS = ['create', 'update', 'delete', 'occurrence_action'] as const;
export type SyncAction = (typeof SYNC_ACTIONS)[number];

/** Resources that hang off an item; their access always follows the parent item (modules.md §1). */
export const ITEM_CHILD_TYPES: readonly ResourceType[] = [
  'item_exception',
  'occurrence_state',
  'checklist_item',
  'checklist_state',
  'participation',
  'reminder_rule',
];
