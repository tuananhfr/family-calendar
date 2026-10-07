import type { components } from "../api/schema";
import type { OutboxOp } from "./outbox-types";

export type OperationWire = components["schemas"]["OperationDto"];
export type OperationResultWire = components["schemas"]["OperationResultDto"];
export type ChangeWire = components["schemas"]["ChangeDto"];
export type ChangesPage = components["schemas"]["ChangesResponseDto"];
export type SnapshotWire = components["schemas"]["SnapshotResponseDto"];

/** What the sync engine needs from the server; errors are ApiRequestError (code `NETWORK` when unreachable). */
export interface SyncTransport {
  sendOperations(spaceId: string, ops: OperationWire[]): Promise<{ results: OperationResultWire[]; policyVersion: string }>;
  getChanges(spaceId: string, cursor: string): Promise<ChangesPage>;
  getSnapshot(spaceId: string): Promise<SnapshotWire>;
}

export function toOperationWire(op: OutboxOp): OperationWire {
  return {
    operation_id: op.operationId,
    resource_type: op.resourceType,
    resource_id: op.resourceId,
    action: op.action,
    base_revision: op.baseRevision,
    payload: (op.payload ?? null) as OperationWire["payload"],
    client_created_at: op.clientCreatedAt,
    schema_version: op.schemaVersion,
  };
}
