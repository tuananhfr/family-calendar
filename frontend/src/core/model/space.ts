import { z } from "zod";
import { baseRecordShape, optionalText, requiredText, timeZoneSchema } from "./base";
import { SPACE_KINDS } from "./common";

export const SHARING_STATES = ["LOCAL", "SHARED"] as const;
export type SharingState = (typeof SHARING_STATES)[number];

/** Space-level settings (modules.md §16 "Chung"); synced as resource `space_settings`. */
export const spaceSettingsSchema = z.object({
  description: optionalText(200, "DESCRIPTION"),
  avatar: z.string().max(100).optional(),
  weekStartsOn: z.union([z.literal(0), z.literal(1)]),
  dateFormat: z.enum(["dd/MM/yyyy", "yyyy-MM-dd"]),
  showIllustrations: z.boolean(),
  showQuickReminders: z.boolean(),
  showUpcomingBirthdays: z.boolean(),
  weatherEnabled: z.boolean(),
  weatherCity: z.string().max(60).optional(),
});
export type SpaceSettings = z.infer<typeof spaceSettingsSchema>;

export const DEFAULT_SPACE_SETTINGS: SpaceSettings = {
  weekStartsOn: 1,
  dateFormat: "dd/MM/yyyy",
  showIllustrations: true,
  showQuickReminders: true,
  showUpcomingBirthdays: true,
  weatherEnabled: false,
};

/** A Space row; `spaceId` equals `id` so it fits the shared BaseRecord shape. */
export const spaceSchema = z
  .object({
    ...baseRecordShape,
    kind: z.enum(SPACE_KINDS),
    name: requiredText(100, "NAME"),
    timeZone: timeZoneSchema,
    sharingState: z.enum(SHARING_STATES),
    settings: spaceSettingsSchema,
  })
  .refine((s) => s.spaceId === s.id, { error: "SPACE_ID_MISMATCH", path: ["spaceId"] });
export type Space = z.infer<typeof spaceSchema>;
