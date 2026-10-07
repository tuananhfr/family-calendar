import { newId } from "../ids";
import type { BaseRecord } from "../sync/resource-types";

/** Valid BaseRecord columns for schema tests. */
export function baseFields(overrides: Partial<BaseRecord> = {}): BaseRecord {
  return {
    id: newId(),
    spaceId: newId(),
    createdByActorId: newId(),
    dataClass: "NORMAL",
    sharingScope: "FAMILY_ALL",
    revision: null,
    createdAt: "2026-10-06T00:00:00.000Z",
    updatedAt: "2026-10-06T00:00:00.000Z",
    deletedAt: null,
    syncState: "LOCAL",
    ...overrides,
  };
}

export function issueCodes(result: { success: boolean; error?: { issues: { message: string }[] } }): string[] {
  return result.success ? [] : (result.error?.issues.map((i) => i.message) ?? []);
}
