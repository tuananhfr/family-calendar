import { z } from "zod";
import { isLocalDate } from "../time/local-date";
import { isLocalDateTime, isValidTimeZone } from "../time/zoned";
import { DATA_CLASSES, SHARING_SCOPES, SYNC_STATES } from "./common";

// Messages are stable codes; UI maps them to Vietnamese text in i18n, never shows them raw.
export const idSchema = z.uuid({ error: "INVALID_ID" });
export const localDateSchema = z.string().refine(isLocalDate, { error: "INVALID_DATE" });
export const localDateTimeSchema = z.string().refine(isLocalDateTime, { error: "INVALID_DATETIME" });
export const timeZoneSchema = z.string().refine(isValidTimeZone, { error: "INVALID_TIME_ZONE" });
export const isoInstantSchema = z.iso.datetime({ offset: true, error: "INVALID_TIMESTAMP" });
/** 'YYYY-MM' */
export const yearMonthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, { error: "INVALID_MONTH" });

/** Integer VND; DECIMAL(15,0) on the server, so at most 15 digits. */
export const MAX_MONEY = 999_999_999_999_999;
export const moneySchema = z
  .int({ error: "AMOUNT_NOT_INTEGER" })
  .min(0, { error: "AMOUNT_NEGATIVE" })
  .max(MAX_MONEY, { error: "AMOUNT_TOO_LARGE" });

export function requiredText(max: number, code = "TEXT") {
  return z
    .string()
    .trim()
    .min(1, { error: `${code}_REQUIRED` })
    .max(max, { error: `${code}_TOO_LONG` });
}

export function optionalText(max: number, code = "TEXT") {
  return z.string().trim().max(max, { error: `${code}_TOO_LONG` }).optional();
}

export function uniqueArray<T extends z.ZodType>(item: T, max: number, code = "LIST") {
  return z
    .array(item)
    .max(max, { error: `${code}_TOO_MANY` })
    .refine((a) => new Set(a).size === a.length, { error: `${code}_DUPLICATE` });
}

export const baseRecordShape = {
  id: idSchema,
  spaceId: idSchema,
  createdByActorId: idSchema,
  dataClass: z.enum(DATA_CLASSES),
  sharingScope: z.enum(SHARING_SCOPES),
  revision: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable(),
  syncState: z.enum(SYNC_STATES),
};
