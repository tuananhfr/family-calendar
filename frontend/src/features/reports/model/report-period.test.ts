import { describe, expect, it } from "vitest";
import { accessContextFor } from "@/core/access/evaluate";
import type { LocalDataView } from "@/core/repo/data-view";
import { makeItem, makeMember, makeState } from "@/core/test-support/items";
import { periodWindow, reportForPeriod } from "./report-period";

const actorId = "4d75a18e-d218-4d96-bdea-1282906d08bc";
const access = accessContextFor("OWNER", { actorId, spaceKind: "FAMILY", representedMemberIds: [], representedProfiles: ["PARENT"] });
const data = (items: LocalDataView["items"]): LocalDataView => ({ space: { timeZone: "Asia/Ho_Chi_Minh", settings: { weekStartsOn: 1 } } as LocalDataView["space"], items, members: [], exceptions: [], states: [], rules: [], files: [], financeTxns: [], healthNotes: [] });

describe("local report periods", () => {
  it("keeps weeks across month/year boundaries and honors Sunday starts", () => {
    expect(periodWindow("2026-01-01", "WEEK")).toEqual({ from: "2025-12-29", to: "2026-01-04" });
    expect(periodWindow("2026-01-01", "WEEK", 0)).toEqual({ from: "2025-12-28", to: "2026-01-03" });
    expect(periodWindow("2024-02-10", "MONTH")).toEqual({ from: "2024-02-01", to: "2024-02-29" });
  });
  it("counts only the selected week and compares the immediately previous week", () => {
    const rows = data([makeItem({ start: "2025-12-22T18:00" }), makeItem({ start: "2025-12-29T18:00" }), makeItem({ start: "2026-01-04T18:00" }), makeItem({ start: "2026-01-05T18:00" })]);
    const report = reportForPeriod(rows, "2026-01-01", "WEEK", access, "2026-01-01");
    expect(report.events).toEqual({ count: 2, deltaPercent: 100 });
  });
  it("does not leak active-member counts from another actor's PRIVATE state", () => {
    const member = makeMember("Người khác", { linkedActorId: actorId });
    const hidden = makeItem({ title: "Hidden", sharingScope: "PRIVATE", createdByActorId: "1cd17e85-5769-465a-89b4-7cfce56cd55c", start: "2026-10-14T18:00" });
    const rows = data([hidden]); rows.members = [member];
    rows.states = [makeState(hidden, hidden.schedule.start, "DONE", { actedByActorId: actorId, actedAt: "2026-10-14T00:00:00Z" })];
    const report = reportForPeriod(rows, "2026-10-14", "MONTH", access, "2026-10-14");
    expect(report.events.count).toBe(0); expect(report.members).toEqual({ active: 0, total: 1 });
  });
});
