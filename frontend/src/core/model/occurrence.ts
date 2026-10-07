import { z } from "zod";
import { baseRecordShape, idSchema, isoInstantSchema, requiredText } from "./base";

const overrideSchema = z.object({
  start: z.string().optional(),
  end: z.string().optional(),
  allDay: z.boolean().optional(),
  title: requiredText(200, "TITLE").optional(),
});

export const itemExceptionSchema = z
  .object({
    ...baseRecordShape,
    itemId: idSchema,
    occurrenceKey: z.string().min(3).max(100),
    kind: z.enum(["CANCEL", "OVERRIDE"]),
    override: overrideSchema.optional(),
  })
  .refine((e) => e.kind === "CANCEL" || e.override !== undefined, { error: "OVERRIDE_REQUIRED", path: ["override"] });
export type ItemExceptionRecord = z.infer<typeof itemExceptionSchema>;

export const OCCURRENCE_STATUSES = ["DONE", "SNOOZED", "SKIPPED"] as const;
export type OccurrenceStatus = (typeof OCCURRENCE_STATUSES)[number];

/** Completion/snooze of one occurrence; DONE today never applies to tomorrow. */
export const occurrenceStateSchema = z.object({
  ...baseRecordShape,
  itemId: idSchema,
  occurrenceKey: z.string().min(3).max(100),
  status: z.enum(OCCURRENCE_STATUSES),
  actedAt: isoInstantSchema,
  actedByActorId: idSchema,
  /** SNOOZED: instant of the new trigger. */
  snoozeUntil: isoInstantSchema.nullable().optional(),
});
export type OccurrenceState = z.infer<typeof occurrenceStateSchema>;

export const checklistItemSchema = z.object({
  ...baseRecordShape,
  itemId: idSchema,
  text: requiredText(200, "TEXT"),
  position: z.int().min(0),
});
export type ChecklistItem = z.infer<typeof checklistItemSchema>;

export const checklistStateSchema = z.object({
  ...baseRecordShape,
  itemId: idSchema,
  checklistItemId: idSchema,
  /** State is per occurrence so ticking an item today doesn't tick it next week. */
  occurrenceKey: z.string().min(3).max(100),
  checked: z.boolean(),
});
export type ChecklistState = z.infer<typeof checklistStateSchema>;

export const PARTICIPATION_RESPONSES = ["YES", "NO", "MAYBE"] as const;
export type ParticipationResponse = (typeof PARTICIPATION_RESPONSES)[number];

export const participationSchema = z.object({
  ...baseRecordShape,
  itemId: idSchema,
  /** null = applies to the whole item. */
  occurrenceKey: z.string().min(3).max(100).nullable(),
  memberId: idSchema,
  response: z.enum(PARTICIPATION_RESPONSES),
});
export type Participation = z.infer<typeof participationSchema>;
