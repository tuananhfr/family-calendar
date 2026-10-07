import type { ResourceType } from "./resource-types";

// Lifecycle from sync-protocol.md "State client"; SENDING found after a crash goes back to QUEUED with the
// same operationId so the server's idempotency can dedupe it.
export const OUTBOX_STATES = ["QUEUED", "SENDING", "ACKNOWLEDGED", "RETRY_WAIT", "CONFLICT", "BLOCKED", "INVALID"] as const;
export type OutboxState = (typeof OUTBOX_STATES)[number];

export type OutboxAction = "create" | "update" | "delete" | "occurrence_action";

export interface OutboxOp {
  operationId: string;
  spaceId: string;
  resourceType: ResourceType;
  resourceId: string;
  action: OutboxAction;
  baseRevision: string | null;
  payload: unknown;
  clientCreatedAt: string;
  schemaVersion: 1;
  state: OutboxState;
  attempts: number;
  nextAttemptAt: string | null;
  /** 1 = send first (occurrence actions such as DONE from a notification). */
  priority: 0 | 1;
  lastErrorCode?: string;
  /** Field codes of a VALIDATION_FAILED rejection, for the fix-and-resend UI. */
  lastErrorFields?: Record<string, string>;
  /** REVISION_CONFLICT / FORBIDDEN: the server record the caller may read (null = not readable), kept for reconciliation. */
  conflictCurrent?: Record<string, unknown> | null;
}
