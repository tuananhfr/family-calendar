import { ApiRequestError } from "../api/errors";
import type { ChangeWire, ChangesPage, OperationResultWire, OperationWire, SnapshotWire, SyncTransport } from "../sync/transport";

type Rec = Record<string, unknown> & { id: string; revision: string; deletedAt: string | null };
interface LogEntry {
  seq: number;
  type: string;
  id: string;
}

/**
 * In-memory stand-in for the sync endpoints with the backend's rules that the client depends on: idempotent
 * operation ids, base_revision checks, latest-entry-per-record change pages and a policy_version.
 */
export class FakeSyncServer implements SyncTransport {
  records = new Map<string, Rec>();
  space: Record<string, unknown> = {};
  policyVersion = "1";
  /** Operation ids per sendOperations call. */
  sent: string[][] = [];
  /** Thrown by the next sendOperations / getChanges call(s). */
  failSend: ApiRequestError[] = [];
  failChanges: ApiRequestError[] = [];
  /** Forced per-operation rejections by resource id. */
  rejectByResource = new Map<string, { code: string; current?: Record<string, unknown> | null; fields?: Record<string, string> }>();
  snapshotCalls = 0;
  pageSize = 500;
  private processed = new Map<string, OperationResultWire>();
  private log: LogEntry[] = [];

  key(type: string, id: string): string {
    return `${type}:${id}`;
  }

  get head(): number {
    return this.log.length;
  }

  live(type: string): Rec[] {
    return [...this.records.entries()].filter(([k, r]) => k.startsWith(`${type}:`) && r.deletedAt === null).map(([, r]) => r);
  }

  /** A write made by another device. */
  put(type: string, record: Record<string, unknown> & { id: string }): Rec {
    const prev = this.records.get(this.key(type, record.id));
    const next: Rec = { deletedAt: null, ...record, revision: String(Number(prev?.revision ?? 0) + 1) };
    this.records.set(this.key(type, record.id), next);
    this.log.push({ seq: this.log.length + 1, type, id: record.id });
    return next;
  }

  remove(type: string, id: string): void {
    const prev = this.records.get(this.key(type, id));
    if (!prev) return;
    this.records.set(this.key(type, id), { ...prev, deletedAt: "2026-10-07T00:00:00.000Z", revision: String(Number(prev.revision) + 1) });
    this.log.push({ seq: this.log.length + 1, type, id });
  }

  async sendOperations(_spaceId: string, ops: OperationWire[]) {
    this.sent.push(ops.map((o) => o.operation_id));
    const fail = this.failSend.shift();
    if (fail) throw fail;
    const results = ops.map((op) => {
      const done = this.processed.get(op.operation_id);
      if (done) return done;
      const result = this.apply(op);
      this.processed.set(op.operation_id, result);
      return result;
    });
    return { results, policyVersion: this.policyVersion };
  }

  private reject(op: OperationWire, code: string, extra: Partial<OperationResultWire> = {}): OperationResultWire {
    return { operation_id: op.operation_id, status: "REJECTED", error: { code, message: code }, ...extra };
  }

  private apply(op: OperationWire): OperationResultWire {
    const forced = this.rejectByResource.get(op.resource_id);
    if (forced) return this.reject(op, forced.code, { current: forced.current ?? null, error: { code: forced.code, message: forced.code, fields: forced.fields } });
    const existing = this.records.get(this.key(op.resource_type, op.resource_id));
    if (op.action === "create") {
      if (existing) return this.reject(op, "ID_COLLISION");
    } else if (op.action !== "occurrence_action" || existing) {
      if (!existing) return this.reject(op, "NOT_FOUND");
      if (existing.deletedAt !== null) return this.reject(op, "RESOURCE_DELETED");
      if (op.base_revision !== existing.revision) return this.reject(op, "REVISION_CONFLICT", { current: existing });
    }
    if (op.action === "delete") {
      this.remove(op.resource_type, op.resource_id);
      const rec = this.records.get(this.key(op.resource_type, op.resource_id))!;
      return { operation_id: op.operation_id, status: "APPLIED", revision: rec.revision, record: null };
    }
    const rec = this.put(op.resource_type, { ...(op.payload as Record<string, unknown>), id: op.resource_id });
    return { operation_id: op.operation_id, status: "APPLIED", revision: rec.revision, record: rec };
  }

  async getChanges(_spaceId: string, cursor: string): Promise<ChangesPage> {
    const fail = this.failChanges.shift();
    if (fail) throw fail;
    const from = Number(cursor);
    if (from > this.head) throw new ApiRequestError("RESYNC_REQUIRED", 409);
    const to = Math.min(this.head, from + this.pageSize);
    const latest = new Map<string, LogEntry>();
    for (const e of this.log.slice(from, to)) latest.set(this.key(e.type, e.id), e);
    const changes: ChangeWire[] = [...latest.values()].map((e) => {
      const rec = this.records.get(this.key(e.type, e.id))!;
      const base = { seq: String(e.seq), resource_type: e.type as ChangeWire["resource_type"], resource_id: e.id, revision: rec.revision };
      return rec.deletedAt === null ? { ...base, op: "UPSERT" as const, record: rec } : { ...base, op: "DELETE" as const };
    });
    return { changes, next_cursor: String(to), has_more: to < this.head, policy_version: this.policyVersion };
  }

  async getSnapshot(spaceId: string): Promise<SnapshotWire> {
    this.snapshotCalls += 1;
    const records: Record<string, Record<string, unknown>[]> = {};
    for (const [k, r] of this.records) {
      if (r.deletedAt !== null) continue;
      const type = k.slice(0, k.indexOf(":"));
      (records[type] ??= []).push(r);
    }
    return {
      watermark: String(this.head),
      policy_version: this.policyVersion,
      space: { id: spaceId, ...this.space },
      records,
      memberships: [],
      access: { actorId: "actor", roleKey: "OWNER", matrix: {}, restrictions: {}, representedMemberIds: [], guardianOfMemberIds: [] },
    };
  }
}
