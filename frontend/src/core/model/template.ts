import { z } from "zod";
import { baseRecordShape, optionalText, requiredText } from "./base";
import { ALL_PRESETS, CATEGORIES, ITEM_KINDS, isPresetOfKind } from "./common";

/** User-saved plan template (system templates are static JSON in the frontend, modules.md §15). */
export const templateSchema = z
  .object({
    ...baseRecordShape,
    kind: z.enum(ITEM_KINDS),
    preset: z.enum(ALL_PRESETS),
    category: z.enum(CATEGORIES),
    title: requiredText(200, "TITLE"),
    durationMinutes: z.int().min(0).max(7 * 24 * 60).optional(),
    checklist: z.array(requiredText(200, "TEXT")).max(50),
    reminderOffsetsMinutes: z.array(z.int().min(0)).max(10),
    note: optionalText(2000, "NOTE"),
  })
  .refine((t) => isPresetOfKind(t.kind, t.preset), { error: "PRESET_NOT_IN_KIND", path: ["preset"] });
export type Template = z.infer<typeof templateSchema>;
