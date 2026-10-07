import { api } from "../api/client";
import type { ChangesPage, OperationResultWire, OperationWire, SnapshotWire, SyncTransport } from "./transport";

export const CHANGES_PAGE_LIMIT = 500;

const spacePath = (spaceId: string) => `/spaces/${encodeURIComponent(spaceId)}/sync`;

export function createHttpTransport(): SyncTransport {
  return {
    async sendOperations(spaceId: string, ops: OperationWire[]) {
      const res = await api<{ results: OperationResultWire[]; policy_version: string }>("POST", `${spacePath(spaceId)}/operations`, { operations: ops });
      return { results: res.results, policyVersion: res.policy_version };
    },
    getChanges(spaceId: string, cursor: string) {
      const query = new URLSearchParams({ cursor, limit: String(CHANGES_PAGE_LIMIT) });
      return api<ChangesPage>("GET", `${spacePath(spaceId)}/changes?${query}`);
    },
    getSnapshot(spaceId: string) {
      return api<SnapshotWire>("GET", `${spacePath(spaceId)}/snapshot`);
    },
  };
}
