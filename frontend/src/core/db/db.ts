import Dexie, { type Table } from "dexie";
import type { Automation } from "../model/automation";
import type {
  FinanceAccount,
  FinanceBudget,
  FinanceGoal,
  FinanceLoan,
  FinanceSaving,
  FinanceTxn,
} from "../model/finance";
import type { HealthMetric, HealthNote, HealthProfile } from "../model/health";
import type { Item } from "../model/item";
import type { Member } from "../model/member";
import type {
  ChecklistItem,
  ChecklistState,
  ItemExceptionRecord,
  OccurrenceState,
  Participation,
} from "../model/occurrence";
import type { ReminderRule } from "../model/reminder-rule";
import type { Role } from "../model/role";
import type { Space } from "../model/space";
import type { Folder, StoredFile } from "../model/storage";
import type { Template } from "../model/template";
import type { OutboxOp } from "../sync/outbox-types";

export const DB_NAME = "family-calendar";

export interface LocalIdentityRow {
  key: "self";
  actorId: string;
  deviceId: string;
  createdAt: string;
}

export interface BlobRow {
  id: string;
  fileId?: string;
  kind: "FILE" | "THUMBNAIL" | "AUDIO";
  mime: string;
  size: number;
  data: Blob;
  createdAt: string;
  /** AUDIO only. */
  durationMs?: number;
}

export interface SyncCursorRow {
  spaceId: string;
  cursor: string | null;
  updatedAt: string;
  /** policy_version of the last snapshot; a different value in a changes page forces a new snapshot. */
  policyVersion?: string;
  /** Set when the server refused this device/session; sync stays stopped until cleared. */
  halt?: "AUTH_REQUIRED" | "BLOCKED" | null;
  haltCode?: string;
  lastSyncedAt?: string;
  /** `access` and `memberships` of the last snapshot (role matrix, represented members). */
  access?: Record<string, unknown>;
  memberships?: Array<{ id: string; actorId: string; roleId: string }>;
}

export interface SettingRow {
  key: string;
  value: unknown;
}

export interface NotificationRow {
  id: string;
  spaceId: string | null;
  type: string;
  resourceRef?: { type: string; id: string } | null;
  /** Already safe for SENSITIVE data (generic text). */
  titleSafe: string;
  createdAt: string;
  readAt: string | null;
}

export interface FiredReminderRow {
  id: string;
  spaceId: string;
  occurrenceKey: string;
  firedAt: string;
}

export interface EmergencyEventRow {
  id: string;
  spaceId: string;
  createdAt: string;
  [field: string]: unknown;
}

export interface EmergencyContactRow {
  id: string;
  spaceId: string;
  [field: string]: unknown;
}

/** Dexie schema v1. New versions must only be appended (never edit a shipped version). */
export const DB_SCHEMA_V1 = {
  localIdentity: "key",
  spaces: "id, spaceId, kind, sharingState",
  members: "id, spaceId, updatedAt",
  roles: "id, spaceId",
  items: "id, spaceId, kind, updatedAt, *memberIds",
  itemExceptions: "id, spaceId, itemId",
  occurrenceStates: "id, spaceId, itemId, occurrenceKey",
  checklistItems: "id, spaceId, itemId",
  checklistStates: "id, spaceId, itemId",
  participations: "id, spaceId, itemId",
  reminderRules: "id, spaceId, itemId",
  financeAccounts: "id, spaceId",
  financeTxns: "id, spaceId, date, accountId",
  financeBudgets: "id, spaceId, month",
  financeSavings: "id, spaceId",
  financeLoans: "id, spaceId",
  financeGoals: "id, spaceId",
  healthProfiles: "id, spaceId, memberId",
  healthMetrics: "id, spaceId, memberId, measuredAt",
  healthNotes: "id, spaceId, memberId",
  folders: "id, spaceId, parentId",
  files: "id, spaceId, folderId",
  automations: "id, spaceId",
  templates: "id, spaceId",
  blobs: "id, fileId",
  outbox: "operationId, spaceId, state, resourceId, [spaceId+state]",
  syncCursors: "spaceId",
  settings: "key",
  notifications: "id, spaceId, createdAt",
  firedReminders: "id, spaceId, occurrenceKey",
  emergencyEvents: "id, spaceId, createdAt",
  emergencyContacts: "id, spaceId",
} as const;

export class FamilyDb extends Dexie {
  localIdentity!: Table<LocalIdentityRow, string>;
  spaces!: Table<Space, string>;
  members!: Table<Member, string>;
  roles!: Table<Role, string>;
  items!: Table<Item, string>;
  itemExceptions!: Table<ItemExceptionRecord, string>;
  occurrenceStates!: Table<OccurrenceState, string>;
  checklistItems!: Table<ChecklistItem, string>;
  checklistStates!: Table<ChecklistState, string>;
  participations!: Table<Participation, string>;
  reminderRules!: Table<ReminderRule, string>;
  financeAccounts!: Table<FinanceAccount, string>;
  financeTxns!: Table<FinanceTxn, string>;
  financeBudgets!: Table<FinanceBudget, string>;
  financeSavings!: Table<FinanceSaving, string>;
  financeLoans!: Table<FinanceLoan, string>;
  financeGoals!: Table<FinanceGoal, string>;
  healthProfiles!: Table<HealthProfile, string>;
  healthMetrics!: Table<HealthMetric, string>;
  healthNotes!: Table<HealthNote, string>;
  folders!: Table<Folder, string>;
  files!: Table<StoredFile, string>;
  automations!: Table<Automation, string>;
  templates!: Table<Template, string>;
  blobs!: Table<BlobRow, string>;
  outbox!: Table<OutboxOp, string>;
  syncCursors!: Table<SyncCursorRow, string>;
  settings!: Table<SettingRow, string>;
  notifications!: Table<NotificationRow, string>;
  firedReminders!: Table<FiredReminderRow, string>;
  emergencyEvents!: Table<EmergencyEventRow, string>;
  emergencyContacts!: Table<EmergencyContactRow, string>;

  constructor(name: string = DB_NAME) {
    super(name);
    this.version(1).stores(DB_SCHEMA_V1);
  }
}

// Constructing Dexie doesn't touch IndexedDB; the connection opens lazily on first use (safe during static build).
export const db = new FamilyDb();
