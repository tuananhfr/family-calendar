import { api } from "../api/client";
import type { EmergencyPosition, EmergencyRecord, EmergencyStatus } from "./model";

export interface EmergencyAccepted {
  id: string;
  lifecycle: EmergencyStatus;
  client_triggered_at: string;
  server_received_at: string;
  closed_at: string | null;
  revision: string;
  delivery: "SERVER_ACCEPTED";
}
export interface EmergencyView extends EmergencyAccepted {
  created_by_actor_id: string;
  recipients: Array<{ member_id: string; response: "NONE" | "ACKNOWLEDGED" | "RESPONDING"; responded_at: string | null }>;
  push_submitted: number;
  reason: string | null;
  last_location: { lat: number; lng: number; accuracy: number; captured_at: string; provenance: EmergencyPosition["provenance"] } | null;
}

export function emergencyPath(spaceId: string, id?: string): string {
  return `/spaces/${encodeURIComponent(spaceId)}/emergencies${id ? "/" + encodeURIComponent(id) : ""}`;
}

export function recordFromView(view: EmergencyView, spaceId: string): EmergencyRecord {
  return {
    id: view.id, spaceId, createdAt: view.client_triggered_at, createdByActorId: view.created_by_actor_id, deviceId: "", mode: "SHARED", status: view.lifecycle, delivery: "SERVER_ACCEPTED", revision: view.revision,
    serverReceivedAt: view.server_received_at, closedAt: view.closed_at ?? undefined, reason: view.reason ?? undefined,
    recipients: view.recipients.map((row) => ({ memberId: row.member_id, response: row.response, respondedAt: row.responded_at })), pushSubmitted: view.push_submitted,
    position: view.last_location ? { lat: view.last_location.lat, lng: view.last_location.lng, accuracy: view.last_location.accuracy, capturedAt: view.last_location.captured_at, provenance: view.last_location.provenance } : undefined,
  };
}

export async function readEmergencyViews(spaceId: string): Promise<EmergencyView[]> {
  return (await api<{ emergencies: EmergencyView[] }>("GET", emergencyPath(spaceId))).emergencies;
}
