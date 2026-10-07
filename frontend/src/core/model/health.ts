import { z } from "zod";
import { baseRecordShape, idSchema, localDateSchema, localDateTimeSchema, optionalText, requiredText, uniqueArray } from "./base";

// Family-entered notes for remembering only: no diagnosis, no "good/bad" judgement of values (modules.md §8).

export const SEXES = ["MALE", "FEMALE", "OTHER", "UNSPECIFIED"] as const;
export const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;

export const healthProfileSchema = z.object({
  ...baseRecordShape,
  memberId: idSchema,
  sex: z.enum(SEXES),
  bloodType: z.enum(BLOOD_TYPES, { error: "INVALID_BLOOD_TYPE" }).optional(),
  heightCm: z.number().min(20).max(260).optional(),
  allergies: uniqueArray(z.string().trim().min(1).max(100), 30, "ALLERGIES"),
  conditions: uniqueArray(z.string().trim().min(1).max(100), 30, "CONDITIONS"),
  insuranceNumber: optionalText(30, "INSURANCE"),
  emergencyNote: optionalText(500, "NOTE"),
});
export type HealthProfile = z.infer<typeof healthProfileSchema>;

export const HEALTH_METRIC_TYPES = [
  "WEIGHT",
  "HEIGHT",
  "BLOOD_PRESSURE",
  "HEART_RATE",
  "SLEEP",
  "BLOOD_GLUCOSE",
  "TEMPERATURE",
  "CUSTOM",
] as const;
export type HealthMetricType = (typeof HEALTH_METRIC_TYPES)[number];

/** Display units; CUSTOM carries its own `unit`. */
export const HEALTH_METRIC_UNITS: Record<Exclude<HealthMetricType, "CUSTOM">, string> = {
  WEIGHT: "kg",
  HEIGHT: "cm",
  BLOOD_PRESSURE: "mmHg",
  HEART_RATE: "bpm",
  SLEEP: "giờ",
  BLOOD_GLUCOSE: "mmol/L",
  TEMPERATURE: "°C",
};

export const healthMetricSchema = z
  .object({
    ...baseRecordShape,
    memberId: idSchema,
    type: z.enum(HEALTH_METRIC_TYPES),
    /** Systolic for BLOOD_PRESSURE. */
    value: z.number().finite(),
    /** Diastolic for BLOOD_PRESSURE. */
    value2: z.number().finite().optional(),
    unit: z.string().trim().min(1).max(20).optional(),
    customName: z.string().trim().min(1).max(50).optional(),
    measuredAt: localDateTimeSchema,
    note: optionalText(500, "NOTE"),
  })
  .superRefine((m, ctx) => {
    if (m.type === "BLOOD_PRESSURE" && m.value2 === undefined) {
      ctx.addIssue({ code: "custom", message: "SECOND_VALUE_REQUIRED", path: ["value2"] });
    }
    if (m.type === "CUSTOM" && !m.unit) ctx.addIssue({ code: "custom", message: "UNIT_REQUIRED", path: ["unit"] });
    if (m.type === "CUSTOM" && !m.customName) ctx.addIssue({ code: "custom", message: "NAME_REQUIRED", path: ["customName"] });
  });
export type HealthMetric = z.infer<typeof healthMetricSchema>;

export const healthNoteSchema = z.object({
  ...baseRecordShape,
  memberId: idSchema,
  date: localDateSchema,
  title: requiredText(200, "TITLE"),
  body: z.string().max(5000, { error: "BODY_TOO_LONG" }),
});
export type HealthNote = z.infer<typeof healthNoteSchema>;

/** Fixed disclaimer shown on every health screen; text lives in i18n under this key. */
export const HEALTH_DISCLAIMER_KEY = "health.disclaimer";
