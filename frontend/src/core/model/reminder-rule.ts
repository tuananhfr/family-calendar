import { z } from "zod";
import { baseRecordShape, idSchema, uniqueArray } from "./base";
import { CHANNELS, PRIORITIES } from "./common";

const MAX_OFFSET_MINUTES = 366 * 24 * 60;

export const reminderRuleSchema = z
  .object({
    ...baseRecordShape,
    itemId: idSchema,
    /** Minutes before the occurrence start (0 = at start). */
    offsetsMinutes: uniqueArray(
      z.int({ error: "OFFSET_INVALID" }).min(0, { error: "OFFSET_INVALID" }).max(MAX_OFFSET_MINUTES, { error: "OFFSET_INVALID" }),
      10,
      "OFFSETS",
    ),
    /** Calendar months before (documents: 6/3 months), clamped to month end via addMonthsClamped. */
    offsetMonths: uniqueArray(z.int().min(1, { error: "OFFSET_INVALID" }).max(24, { error: "OFFSET_INVALID" }), 5, "OFFSETS").optional(),
    channels: uniqueArray(z.enum(CHANNELS), CHANNELS.length, "CHANNELS").refine((c) => c.length > 0, {
      error: "CHANNELS_REQUIRED",
    }),
    priority: z.enum(PRIORITIES),
    recipientMemberIds: uniqueArray(idSchema, 50, "RECIPIENTS"),
    soundKey: z.string().max(50).optional(),
    audioAssetId: idSchema.optional(),
    enabled: z.boolean().optional(),
  })
  .refine((r) => r.offsetsMinutes.length > 0 || (r.offsetMonths?.length ?? 0) > 0, {
    error: "OFFSETS_REQUIRED",
    path: ["offsetsMinutes"],
  });
export type ReminderRule = z.infer<typeof reminderRuleSchema>;
