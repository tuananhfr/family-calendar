import { describe, expect, it } from "vitest";
import { newId } from "../ids";
import { reminderRuleSchema } from "./reminder-rule";
import { baseFields, issueCodes } from "../test-support/records";

const valid = () => ({
  ...baseFields(),
  itemId: newId(),
  offsetsMinutes: [0, 15, 1440],
  channels: ["IN_APP", "PUSH"],
  priority: "HIGH",
  recipientMemberIds: [],
});

describe("reminderRuleSchema", () => {
  it("accepts offsets in minutes and calendar months", () => {
    expect(reminderRuleSchema.safeParse(valid()).success).toBe(true);
    expect(reminderRuleSchema.safeParse({ ...valid(), offsetsMinutes: [], offsetMonths: [6, 3] }).success).toBe(true);
  });

  it("requires at least one channel and one offset, no duplicates, no negatives", () => {
    expect(issueCodes(reminderRuleSchema.safeParse({ ...valid(), channels: [] }))).toContain("CHANNELS_REQUIRED");
    expect(issueCodes(reminderRuleSchema.safeParse({ ...valid(), channels: ["PUSH", "PUSH"] }))).toContain("CHANNELS_DUPLICATE");
    expect(issueCodes(reminderRuleSchema.safeParse({ ...valid(), offsetsMinutes: [] }))).toContain("OFFSETS_REQUIRED");
    expect(issueCodes(reminderRuleSchema.safeParse({ ...valid(), offsetsMinutes: [-5] }))).toContain("OFFSET_INVALID");
  });
});
