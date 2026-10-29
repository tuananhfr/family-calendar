import { emergencyRecordSchema } from "./schema";

export type EmergencyStatus = "ACTIVE" | "CLOSED_SAFE" | "CLOSED_ENDED";
export type EmergencyDelivery = "LOCAL_PENDING" | "SERVER_ACCEPTED" | "BLOCKED" | "FAILED_RETRYABLE";
export interface EmergencyPosition {
  lat: number;
  lng: number;
  accuracy: number;
  capturedAt: string;
  provenance: "CURRENT" | "LAST_KNOWN";
}
export interface EmergencyRecipient {
  memberId: string;
  response: "NONE" | "ACKNOWLEDGED" | "RESPONDING";
  respondedAt: string | null;
}
export interface EmergencyRecord {
  [field: string]: unknown;
  id: string;
  spaceId: string;
  createdAt: string;
  createdByActorId: string;
  deviceId: string;
  status: EmergencyStatus;
  mode: "LOCAL" | "SHARED";
  delivery: EmergencyDelivery;
  closedAt?: string;
  serverReceivedAt?: string;
  serverClosedConfirmedAt?: string;
  reason?: string;
  position?: EmergencyPosition;
  recipients?: EmergencyRecipient[];
  pushSubmitted?: number;
  errorCode?: string;
  revision?: string;
}
export interface EmergencyQueueRow {
  id: string;
  spaceId: string;
  eventId: string;
  actorId: string;
  operationId: string;
  kind: "RECONCILE" | "RESPONSE" | "LOCATION";
  payload?: EmergencyPosition | { kind: "ACKNOWLEDGED" | "RESPONDING" };
  attempts: number;
  nextAttemptAt: number;
  leaseOwner?: string;
  leaseUntil?: number;
  blocked?: boolean;
}

export function isEmergencyRecord(value: unknown): value is EmergencyRecord {
  return emergencyRecordSchema.safeParse(value).success;
}

export function locationLabel(position: EmergencyPosition | undefined, status: EmergencyStatus, watching: boolean, foreground: boolean, now: number): "NONE" | "LIVE" | "LAST" {
  if (!position) return "NONE";
  const age = now - Date.parse(position.capturedAt);
  return status === "ACTIVE" && watching && foreground && position.provenance === "CURRENT" && age >= 0 && age <= 60_000 ? "LIVE" : "LAST";
}

export function shouldPurgePosition(event: EmergencyRecord, now: number): boolean {
  return event.status !== "ACTIVE" && !!event.serverClosedConfirmedAt && now - Date.parse(event.serverClosedConfirmedAt) >= 24 * 3600_000;
}
