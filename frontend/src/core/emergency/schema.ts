import { z } from "zod";
import { idSchema, isoInstantSchema } from "../model/base";
import { normalizedPhone } from "./phone";

export const emergencyPositionSchema = z.object({ lat: z.number().finite().min(-90).max(90), lng: z.number().finite().min(-180).max(180), accuracy: z.number().finite().min(0).max(100_000), capturedAt: isoInstantSchema, provenance: z.enum(["CURRENT", "LAST_KNOWN"]) });
export const emergencyRecordSchema = z.object({
  id: idSchema, spaceId: idSchema, createdAt: isoInstantSchema, createdByActorId: idSchema, deviceId: z.union([idSchema, z.literal("")]),
  status: z.enum(["ACTIVE", "CLOSED_SAFE", "CLOSED_ENDED"]), mode: z.enum(["LOCAL", "SHARED"]), delivery: z.enum(["LOCAL_PENDING", "SERVER_ACCEPTED", "BLOCKED", "FAILED_RETRYABLE"]),
  closedAt: isoInstantSchema.optional(), serverReceivedAt: isoInstantSchema.optional(), serverClosedConfirmedAt: isoInstantSchema.optional(), reason: z.string().max(200).optional(), position: emergencyPositionSchema.optional(),
  recipients: z.array(z.object({ memberId: idSchema, response: z.enum(["NONE", "ACKNOWLEDGED", "RESPONDING"]), respondedAt: isoInstantSchema.nullable() })).optional(),
  pushSubmitted: z.int().min(0).optional(), errorCode: z.string().max(80).optional(), revision: z.string().optional(),
}).passthrough();
export const emergencyContactSchema = z.object({ id: idSchema, spaceId: idSchema, name: z.string().trim().min(1).max(100), phone: z.string().refine((phone) => !!normalizedPhone(phone)), country: z.string().regex(/^[A-Z]{2}$/).optional() }).passthrough();
