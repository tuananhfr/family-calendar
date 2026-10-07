import { z } from "zod";
import { baseRecordShape } from "./base";

/** Fixed if-then rules run by the backend worker, no AI (modules.md §11). */
export const AUTOMATION_RULES = ["PAYMENT_DUE_REMINDER", "WEEKLY_SUMMARY", "EXAM_REVIEW_TASK"] as const;
export type AutomationRuleKey = (typeof AUTOMATION_RULES)[number];

export const AUTOMATION_DEFAULT_PARAMS: Record<AutomationRuleKey, Record<string, number | string | boolean>> = {
  PAYMENT_DUE_REMINDER: { daysBefore: 3 },
  WEEKLY_SUMMARY: { weekday: "SU", time: "20:00" },
  EXAM_REVIEW_TASK: { daysBefore: 3 },
};

export const automationSchema = z.object({
  ...baseRecordShape,
  ruleKey: z.enum(AUTOMATION_RULES),
  enabled: z.boolean(),
  params: z.record(z.string().max(40), z.union([z.number().finite(), z.string().max(100), z.boolean()])),
  lastRunAt: z.string().nullable().optional(),
});
export type Automation = z.infer<typeof automationSchema>;
