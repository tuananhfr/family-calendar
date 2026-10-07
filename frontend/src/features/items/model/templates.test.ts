import { describe, expect, it } from "vitest";
import { newId } from "@/core/ids";
import { itemSchema } from "@/core/model/item";
import { reminderRuleSchema } from "@/core/model/reminder-rule";
import { formToItem } from "./form-to-item";
import { SYSTEM_TEMPLATES, applyTemplate, templateByKey } from "./templates";

const ctx = { spaceId: newId(), actorId: newId(), timeZone: "Asia/Ho_Chi_Minh" };

describe("SYSTEM_TEMPLATES", () => {
  it("has the 10 templates of /mau-ke-hoach with unique keys", () => {
    expect(SYSTEM_TEMPLATES.map((t) => t.title)).toEqual([
      "Họp phụ huynh",
      "Khám sức khỏe",
      "Sinh nhật",
      "Du lịch / Nghỉ lễ",
      "Hoạt động ngoại khóa",
      "Lịch học thêm",
      "Đến hạn giấy tờ",
      "Sự kiện gia đình",
      "Uống thuốc",
      "Thanh toán định kỳ",
    ]);
    expect(new Set(SYSTEM_TEMPLATES.map((t) => t.key)).size).toBe(10);
  });

  it.each(SYSTEM_TEMPLATES.map((t) => [t.key, t] as const))("%s produces a schema-valid item and rule", (_key, t) => {
    const v = applyTemplate(t, { date: "2026-10-08", memberIds: [newId()] });
    const { item, rule } = formToItem(v, ctx);
    const parsed = itemSchema.safeParse(item);
    expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
    expect(item.templateKey).toBe(t.key);
    if (rule) expect(reminderRuleSchema.safeParse(rule).success).toBe(true);
  });

  it("medication template is SENSITIVE + PRIVATE even when the base form was family-wide", () => {
    const v = applyTemplate(templateByKey("MEDICATION")!, { date: "2026-10-08", sharingScope: "FAMILY_ALL" });
    expect(v.sharingScope).toBe("PRIVATE");
    expect(formToItem(v, ctx).item.dataClass).toBe("SENSITIVE");
  });

  it("keeps what the user already typed (title, date, members) and fills the rest", () => {
    const member = newId();
    const v = applyTemplate(templateByKey("HEALTH_CHECKUP")!, { title: "Khám răng cho Minh", date: "2026-11-02", memberIds: [member] });
    expect(v).toMatchObject({ title: "Khám răng cho Minh", date: "2026-11-02", memberIds: [member], preset: "APPOINTMENT", category: "HEALTH" });
    expect(v.checklist.length).toBeGreaterThan(0);
  });

  it("document expiry template reminds 6 and 3 months, 30, 7 and 1 day before", () => {
    const v = applyTemplate(templateByKey("DOCUMENT_EXPIRY")!, { date: "2027-08-31" });
    const { rule } = formToItem(v, ctx);
    expect(rule).toMatchObject({ offsetMonths: [6, 3], offsetsMinutes: [30 * 1440, 7 * 1440, 1440] });
  });

  it("end time comes from the duration and never passes midnight", () => {
    expect(applyTemplate(templateByKey("PARENT_MEETING")!, { date: "2026-10-08" })).toMatchObject({ startTime: "08:00", endTime: "09:30" });
    expect(applyTemplate(templateByKey("FAMILY_EVENT")!, { date: "2026-10-08", startTime: "23:00" }).endTime).toBe("23:59");
  });

  it("requires a date", () => {
    expect(() => applyTemplate(SYSTEM_TEMPLATES[0], {})).toThrow(RangeError);
  });
});
