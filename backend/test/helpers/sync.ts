import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import type { Response } from 'supertest';
import { AccessService } from '../../src/modules/access/access.service';
import { withTransaction } from '../../src/database/transaction';
import { registerDevice, type RegisteredDevice } from './session';
import { createSharedSpace, insertMember, type SeededSpace } from './spaces';
import type { DataSource } from 'typeorm';

export interface OpInput {
  operation_id?: string;
  resource_type: string;
  resource_id: string;
  action: 'create' | 'update' | 'delete' | 'occurrence_action';
  base_revision?: string | null;
  payload?: unknown;
}

export function op(input: OpInput) {
  return {
    operation_id: input.operation_id ?? randomUUID(),
    resource_type: input.resource_type,
    resource_id: input.resource_id,
    action: input.action,
    base_revision: input.base_revision ?? null,
    payload: input.payload ?? null,
    client_created_at: new Date().toISOString(),
    schema_version: 1,
  };
}

export function sendOps(dev: RegisteredDevice, spaceId: string, operations: unknown[]): Promise<Response> {
  return dev.agent
    .post(`/api/v1/spaces/${spaceId}/sync/operations`)
    .set('X-CSRF-Token', dev.csrf)
    .send({ operations });
}

/** Common columns as the frontend sends them (BaseRecord minus syncState/revision). */
export function base(spaceId: string, actorId: string, id: string = randomUUID(), extra: Record<string, unknown> = {}) {
  const now = new Date().toISOString();
  return {
    id,
    spaceId,
    createdByActorId: actorId,
    dataClass: 'NORMAL',
    sharingScope: 'FAMILY_ALL',
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...extra,
  };
}

export function itemPayload(spaceId: string, actorId: string, overrides: Record<string, unknown> = {}) {
  return {
    ...base(spaceId, actorId),
    kind: 'EVENT',
    preset: 'EVENT',
    title: 'Họp phụ huynh',
    schedule: { allDay: false, start: '2026-10-10T08:00', end: '2026-10-10T09:00', timeZone: 'Asia/Ho_Chi_Minh' },
    memberIds: [],
    category: 'FAMILY',
    priority: 'MEDIUM',
    attachments: [],
    showOnCalendar: true,
    calendarSystem: 'SOLAR',
    ...overrides,
  };
}

export interface Family {
  owner: RegisteredDevice;
  adult: RegisteredDevice;
  child: RegisteredDevice;
  space: SeededSpace;
  childMemberId: string;
  adultMemberId: string;
}

/** OWNER + ADULT + MEMBER(child, representing a CHILD member) in one SHARED FAMILY Space. */
export async function seedFamily(app: INestApplication, ds: DataSource, ipBase = '10.9.0'): Promise<Family> {
  const access = app.get(AccessService);
  const owner = await registerDevice(app, { ip: `${ipBase}.1` });
  const adult = await registerDevice(app, { ip: `${ipBase}.2` });
  const child = await registerDevice(app, { ip: `${ipBase}.3` });
  const asCtx = (d: RegisteredDevice) => ({ sessionId: randomUUID(), actorId: d.actorId, deviceId: d.deviceId, accountId: null });
  const space = await createSharedSpace(ds, access, asCtx(owner));
  const childMemberId = await insertMember(ds, space.spaceId, owner.actorId, 'CHILD', 'Bé An');
  const adultMemberId = await insertMember(ds, space.spaceId, owner.actorId, 'PARENT', 'Mẹ');
  await withTransaction(ds, async (em) => {
    await access.addMembership(em, space.spaceId, adult.actorId, space.roleIds.ADULT);
    await access.addMembership(em, space.spaceId, child.actorId, space.roleIds.MEMBER);
    await access.addRepresentation(em, space.spaceId, child.actorId, childMemberId, 'SELF');
    await access.addRepresentation(em, space.spaceId, adult.actorId, adultMemberId, 'SELF');
  });
  return { owner, adult, child, space, childMemberId, adultMemberId };
}
