import { z } from "zod";
import { parseLocalDate, type LocalDate } from "../time/local-date";
import { baseRecordShape, idSchema, localDateSchema, optionalText, requiredText, uniqueArray } from "./base";
import { PROFILES, RELATIONSHIPS } from "./common";

export const MEMBER_STATUSES = ["ACTIVE", "ARCHIVED"] as const;

/** Member (modules.md §3). Phone, email and birth date are PRIVATE fields even though the record is NORMAL. */
export const memberSchema = z.object({
  ...baseRecordShape,
  displayName: requiredText(50, "NAME"),
  relationship: z.enum(RELATIONSHIPS),
  profile: z.enum(PROFILES),
  birthDate: localDateSchema.optional(),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9+\-\s().]{6,20}$/, { error: "INVALID_PHONE" })
    .optional(),
  email: z.email({ error: "INVALID_EMAIL" }).max(254).optional(),
  /** Preset avatar key or a file id from Kho lưu trữ. */
  avatar: z.string().max(100).optional(),
  /** Design token key, never a raw color. */
  color: z.string().max(30).optional(),
  interests: uniqueArray(z.string().trim().min(1).max(30, { error: "INTEREST_TOO_LONG" }), 5, "INTERESTS"),
  note: optionalText(500, "NOTE"),
  status: z.enum(MEMBER_STATUSES),
  /** Set only by a confirmed link workflow, never guessed from names. */
  linkedActorId: idSchema.nullable().optional(),
});
export type Member = z.infer<typeof memberSchema>;

/** Whole years between birth date and `today` (both local dates). */
export function ageOn(birthDate: LocalDate, today: LocalDate): number {
  const b = parseLocalDate(birthDate);
  const t = parseLocalDate(today);
  const hadBirthday = t.month > b.month || (t.month === b.month && t.day >= b.day);
  return t.year - b.year - (hadBirthday ? 0 : 1);
}
