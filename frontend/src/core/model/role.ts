import { z } from "zod";
import { CAPABILITIES, LEVELS, type Capability } from "../access/capabilities";
import { baseRecordShape, requiredText } from "./base";

const levelSchema = z.enum(LEVELS);

const matrixSchema = z.object(
  Object.fromEntries(CAPABILITIES.map((c) => [c, levelSchema])) as Record<Capability, typeof levelSchema>,
);

export const roleSchema = z.object({
  ...baseRecordShape,
  /** OWNER/ADULT/… for built-ins, CUSTOM_* for user-made roles. */
  key: z.string().regex(/^[A-Z][A-Z0-9_]{1,39}$/, { error: "INVALID_ROLE_KEY" }),
  name: requiredText(50, "NAME"),
  matrix: matrixSchema,
  restrictions: z.partialRecord(z.enum(CAPABILITIES), z.enum(["OWN_OR_ASSIGNED", "RELATED_MEMBERS"])).optional(),
  /** Built-in roles can't be deleted; OWNER can't be renamed either. */
  system: z.boolean(),
  basedOn: z.string().max(40).optional(),
});
export type Role = z.infer<typeof roleSchema>;
