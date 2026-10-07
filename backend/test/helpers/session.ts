import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { SessionsService } from '../../src/modules/identity/sessions.service';

export type SuperAgentTest = ReturnType<typeof request.agent>;

export interface RegisteredDevice {
  agent: SuperAgentTest;
  csrf: string;
  actorId: string;
  deviceId: string;
}

function cookieValue(setCookie: string[] | string | undefined, name: string): string {
  const list = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  const line = list.find((c) => c.startsWith(`${name}=`));
  if (!line) throw new Error(`cookie ${name} not set`);
  return decodeURIComponent(line.slice(name.length + 1).split(';')[0]);
}

/** Registers a fresh Actor + Device through the public API; the agent keeps the session cookie. */
export async function registerDevice(
  app: INestApplication,
  opts: { actorId?: string; deviceId?: string; label?: string; ip?: string } = {},
): Promise<RegisteredDevice> {
  const actorId = opts.actorId ?? randomUUID();
  const deviceId = opts.deviceId ?? randomUUID();
  const agent = request.agent(app.getHttpServer());
  const req = agent.post('/api/v1/devices');
  if (opts.ip) req.set('X-Forwarded-For', opts.ip);
  const res = await req.send({ actorId, deviceId, ...(opts.label ? { label: opts.label } : {}) });
  if (res.status !== 201) throw new Error(`registerDevice failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { agent, csrf: cookieValue(res.headers['set-cookie'], 'fc_csrf'), actorId, deviceId };
}

/**
 * Gives an existing Actor a second Device directly through the service, standing in for the
 * join/recovery workflows that legitimately link devices (no public route does this yet).
 */
export async function addDeviceForActor(app: INestApplication, actorId: string): Promise<RegisteredDevice> {
  const deviceId = randomUUID();
  const issued = await app.get(SessionsService).createDeviceWithSession(actorId, deviceId, { label: 'test' });
  const agent = request.agent(app.getHttpServer());
  agent.set('Cookie', `fc_sid=${issued.sessionToken}; fc_csrf=${issued.csrfToken}`);
  return { agent, csrf: issued.csrfToken, actorId, deviceId };
}

export { cookieValue };
