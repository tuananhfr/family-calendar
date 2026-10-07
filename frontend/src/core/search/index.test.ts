import { describe, expect, it } from "vitest";
import { accessContextFor } from "../access/evaluate";
import type { FinanceTxn } from "../model/finance";
import type { HealthNote } from "../model/health";
import type { StoredFile } from "../model/storage";
import type { LocalDataView } from "../repo/data-view";
import { makeItem, makeMember } from "../test-support/items";
import { baseFields } from "../test-support/records";
import { buildSearchIndex } from "./index";

const me = "7d1f2c3a-1111-4a2b-8c3d-0000000000aa";
const bo = makeMember("Bố");
const owner = accessContextFor("OWNER", { actorId: me, representedMemberIds: [bo.id], representedProfiles: ["PARENT"], spaceKind: "FAMILY" });
const child = accessContextFor("MEMBER", { actorId: "7d1f2c3a-1111-4a2b-8c3d-0000000000bb", representedMemberIds: [], representedProfiles: ["CHILD"], spaceKind: "FAMILY" });

function view(): LocalDataView {
  return {
    space: {} as LocalDataView["space"],
    members: [bo, makeMember("Bé An")],
    items: [
      makeItem({ title: "Đặt lịch khám răng", note: "Nha khoa Kim" }),
      makeItem({ title: "Đưa bé đi học", start: "2026-10-06T07:00" }),
      makeItem({ ...baseFields({ dataClass: "SENSITIVE", createdByActorId: me }), kind: "REMINDER", preset: "MEDICATION", category: "HEALTH", title: "Uống thuốc huyết áp", memberIds: [bo.id] }),
      makeItem({ ...baseFields({ sharingScope: "PRIVATE" }), title: "Quà bí mật khám phá" }),
    ],
    exceptions: [],
    states: [],
    rules: [],
    files: [{ ...baseFields(), name: "Sổ khám bệnh.pdf", folderId: bo.id, mime: "application/pdf", size: 1, sha256: "0".repeat(64), kind: "DOCUMENT", blobState: "LOCAL_ONLY" } as StoredFile],
    financeTxns: [{ ...baseFields(), type: "EXPENSE", amount: 200000, category: "HEALTH", date: "2026-10-01", note: "Tiền khám răng" } as FinanceTxn],
    healthNotes: [{ ...baseFields(), memberId: bo.id, date: "2026-10-01", title: "Khám tổng quát", body: "Uống thuốc đều" } as HealthNote],
  };
}

describe("buildSearchIndex", () => {
  it('"khám" finds "Đặt lịch khám răng", diacritics or not', () => {
    const idx = buildSearchIndex(view(), owner);
    expect(idx.search("khám").map((h) => h.title)).toContain("Đặt lịch khám răng");
    expect(idx.search("kham rang").map((h) => h.title)).toEqual(expect.arrayContaining(["Đặt lịch khám răng", "Tiền khám răng"]));
    expect(idx.search("KHAM").length).toBeGreaterThanOrEqual(3);
  });

  it("searches members, file names, finance notes and health notes for a viewer allowed to read them", () => {
    const idx = buildSearchIndex(view(), owner, { financeCategoryLabel: (c) => (c === "HEALTH" ? "Sức khỏe" : c) });
    const types = new Set(idx.search("khám").map((h) => h.type));
    expect(types).toEqual(new Set(["item", "file", "finance_txn", "health_note"]));
    expect(idx.search("bé an")[0]).toMatchObject({ type: "member", title: "Bé An" });
    expect(idx.search("sức khỏe").some((h) => h.type === "finance_txn")).toBe(true);
  });

  it("a viewer without health permission never finds the medication reminder or health notes", () => {
    const idx = buildSearchIndex(view(), child);
    const hits = idx.search("thuốc");
    expect(hits).toEqual([]);
    expect(idx.search("khám").map((h) => h.type)).not.toContain("health_note");
    expect(idx.search("khám").map((h) => h.type)).not.toContain("finance_txn");
  });

  it("another actor's PRIVATE item is not indexed", () => {
    expect(buildSearchIndex(view(), owner).search("bí mật")).toEqual([]);
  });

  it("an empty query returns nothing", () => {
    expect(buildSearchIndex(view(), owner).search("   ")).toEqual([]);
  });
});
