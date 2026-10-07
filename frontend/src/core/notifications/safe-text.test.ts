import { describe, expect, it } from "vitest";
import { makeItem } from "../test-support/items";
import { GENERIC_BODY, GENERIC_TITLE, safeNotificationText } from "./safe-text";

describe("safeNotificationText", () => {
  const generic = { title: "Lịch Gia Đình", body: "Mở ứng dụng để xem nhắc của bạn." };

  it("uses the fixed generic text", () => {
    expect({ title: GENERIC_TITLE, body: GENERIC_BODY }).toEqual(generic);
  });

  it("SENSITIVE never shows the medicine name, even with showDetails", () => {
    const med = makeItem({ kind: "REMINDER", preset: "MEDICATION", category: "HEALTH", dataClass: "SENSITIVE", title: "Thuốc Amlodipin 5mg" });
    expect(safeNotificationText(med, true)).toEqual(generic);
    expect(JSON.stringify(safeNotificationText(med, true))).not.toContain("Amlodipin");
  });

  it("health items are generic even if mislabelled NORMAL", () => {
    expect(safeNotificationText(makeItem({ category: "HEALTH", title: "Khám tim" }), true)).toEqual(generic);
    expect(safeNotificationText(makeItem({ kind: "REMINDER", preset: "MEDICATION", category: "OTHER", title: "Vitamin" }), true)).toEqual(generic);
  });

  it("NORMAL shows the title only when details are allowed", () => {
    const item = makeItem({ title: "Họp phụ huynh" });
    expect(safeNotificationText(item, true)).toEqual({ title: "Lịch Gia Đình", body: "Họp phụ huynh" });
    expect(safeNotificationText(item, false)).toEqual(generic);
  });

  it("PRIVATE data never reveals amounts or notes", () => {
    const pay = makeItem({ kind: "REMINDER", preset: "PAYMENT", category: "FINANCE", dataClass: "PRIVATE", sharingScope: "PRIVATE", title: "Tiền nhà", amount: 5_000_000, note: "chuyển khoản" });
    const text = JSON.stringify(safeNotificationText(pay, true));
    expect(text).not.toContain("5000000");
    expect(text).not.toContain("chuyển khoản");
    expect(safeNotificationText(pay, false)).toEqual(generic);
  });
});
