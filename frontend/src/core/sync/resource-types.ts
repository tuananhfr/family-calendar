import type { DataClass, SharingScope, SyncState } from "../model/common";

// Frontend copy of the resource registry (modules.md §1); the backend keeps its own copy with the same list.
export const RESOURCE_TYPES = [
  "space_settings",
  "member",
  "role",
  "item",
  "item_exception",
  "occurrence_state",
  "checklist_item",
  "checklist_state",
  "participation",
  "reminder_rule",
  "finance_account",
  "finance_txn",
  "finance_budget",
  "finance_saving",
  "finance_loan",
  "finance_goal",
  "health_profile",
  "health_metric",
  "health_note",
  "folder",
  "file",
  "automation",
  "template",
] as const;
export type ResourceType = (typeof RESOURCE_TYPES)[number];

export const RESOURCE_STORE = {
  space_settings: "spaces",
  member: "members",
  role: "roles",
  item: "items",
  item_exception: "itemExceptions",
  occurrence_state: "occurrenceStates",
  checklist_item: "checklistItems",
  checklist_state: "checklistStates",
  participation: "participations",
  reminder_rule: "reminderRules",
  finance_account: "financeAccounts",
  finance_txn: "financeTxns",
  finance_budget: "financeBudgets",
  finance_saving: "financeSavings",
  finance_loan: "financeLoans",
  finance_goal: "financeGoals",
  health_profile: "healthProfiles",
  health_metric: "healthMetrics",
  health_note: "healthNotes",
  folder: "folders",
  file: "files",
  automation: "automations",
  template: "templates",
} as const satisfies Record<ResourceType, string>;
export type ResourceStoreName = (typeof RESOURCE_STORE)[ResourceType];

/** Resource types whose rows hang off an item (indexed by `itemId`). */
export const ITEM_CHILD_TYPES = [
  "item_exception",
  "occurrence_state",
  "checklist_item",
  "checklist_state",
  "participation",
  "reminder_rule",
] as const satisfies readonly ResourceType[];
export type ItemChildType = (typeof ITEM_CHILD_TYPES)[number];

/** Columns shared by every registry resource (modules.md §1). */
export interface BaseRecord {
  id: string;
  spaceId: string;
  createdByActorId: string;
  dataClass: DataClass;
  sharingScope: SharingScope;
  /** Server revision; null = never acknowledged by the server. */
  revision: string | null;
  /** ISO timestamps (UTC) of local edits; never used for authorization or conflict ordering. */
  createdAt: string;
  updatedAt: string;
  /** Tombstone; read helpers hide rows where this is set. */
  deletedAt: string | null;
  syncState: SyncState;
}

/** Fields that only describe local sync bookkeeping and never go into an operation payload. */
export const LOCAL_ONLY_FIELDS = ["syncState", "revision"] as const;
