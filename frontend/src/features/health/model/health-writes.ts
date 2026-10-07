import type { z } from "zod";
import { db } from "@/core/db/db";
import { getLocalIdentity } from "@/core/db/local-identity";
import { newId } from "@/core/ids";
import { healthMetricSchema, healthNoteSchema, healthProfileSchema, type HealthMetric, type HealthNote, type HealthProfile } from "@/core/model/health";
import { getActive, listActive } from "@/core/repo/read";
import { deleteResource, RepoError, saveResource } from "@/core/repo/write";
import { validateMetric } from "./metrics";

type Base = "id" | "spaceId" | "createdByActorId" | "dataClass" | "sharingScope" | "revision" | "createdAt" | "updatedAt" | "deletedAt" | "syncState";
export type HealthProfileDraft = Omit<HealthProfile, Base>;
export type HealthMetricDraft = Omit<HealthMetric, Base>;
export type HealthNoteDraft = Omit<HealthNote, Base>;
export type HealthType = "health_profile" | "health_metric" | "health_note";

/** field → stable code (or a ready Vietnamese message from validateMetric), mapped by the form. */
export class HealthFormError extends Error {
  constructor(readonly fields: Record<string, string>) {
    super(
      `HEALTH_FORM_INVALID: ${Object.entries(fields)
        .map(([k, v]) => `${k}=${v}`)
        .join(", ")}`,
    );
    this.name = "HealthFormError";
  }
}

async function envelope(spaceId: string, id?: string) {
  const space = await db.spaces.get(spaceId);
  if (!space || space.deletedAt !== null) throw new RepoError("SPACE_NOT_FOUND", spaceId);
  const { actorId } = await getLocalIdentity();
  const now = new Date().toISOString();
  return {
    id: id ?? newId(),
    spaceId,
    createdByActorId: actorId,
    // SENSITIVE keeps records away from roles without `health`, while the member themself still sees their own.
    dataClass: "SENSITIVE" as const,
    sharingScope: space.kind === "FAMILY" ? ("FAMILY_ALL" as const) : ("GROUP_MEMBERS" as const),
    revision: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    syncState: "LOCAL" as const,
  };
}

function parse<T>(schema: z.ZodType<T>, record: unknown): T {
  const res = schema.safeParse(record);
  if (res.success) return res.data;
  const fields: Record<string, string> = {};
  for (const issue of res.error.issues) fields[String(issue.path[0] ?? "form")] ??= issue.message;
  throw new HealthFormError(fields);
}

async function upsert<T extends HealthProfile | HealthMetric | HealthNote>(type: HealthType, schema: z.ZodType<T>, spaceId: string, draft: object, id?: string): Promise<T> {
  const base = await envelope(spaceId, id);
  const existing = id ? await getActive<T>(type, id) : undefined;
  if (id && !existing) throw new RepoError("NOT_FOUND", id);
  const keep = existing ? { createdByActorId: existing.createdByActorId, createdAt: existing.createdAt } : {};
  return saveResource(type, parse(schema, { ...base, ...keep, ...draft }), existing ? "update" : "create");
}

/** One profile per member: saving for a member who already has one updates it instead of adding a twin. */
export async function saveHealthProfile(spaceId: string, draft: HealthProfileDraft): Promise<HealthProfile> {
  const existing = (await listActive<HealthProfile>("health_profile", spaceId)).find((p) => p.memberId === draft.memberId);
  return upsert("health_profile", healthProfileSchema, spaceId, draft, existing?.id);
}

export function saveHealthMetric(spaceId: string, draft: HealthMetricDraft, id?: string): Promise<HealthMetric> {
  const values = draft.type === "BLOOD_PRESSURE" ? [draft.value, draft.value2 ?? Number.NaN] : [draft.value];
  const check = validateMetric({ type: draft.type, values });
  if (!check.ok) return Promise.reject(new HealthFormError({ value: check.message }));
  return upsert("health_metric", healthMetricSchema, spaceId, draft, id);
}

export function saveHealthNote(spaceId: string, draft: HealthNoteDraft, id?: string): Promise<HealthNote> {
  return upsert("health_note", healthNoteSchema, spaceId, draft, id);
}

export function deleteHealthRecord(type: HealthType, id: string): Promise<void> {
  return deleteResource(type, id);
}
