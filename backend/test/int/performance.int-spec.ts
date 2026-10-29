import { performance } from 'node:perf_hooks';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { addDeviceForActor, type RegisteredDevice } from '../helpers/session';
import { seedFamily, sendOps, op, itemPayload, type Family } from '../helpers/sync';
import { truncateAll } from '../helpers/db';
import { createTestApp, type TestApp } from '../helpers/test-app';

const percentile = (values: number[]) => [...values].sort((a, b) => a - b)[Math.ceil(values.length * 0.95) - 1];
describe('approved API performance protocol (int)', () => {
  let t: TestApp;
  let family: Family;
  let clients: RegisteredDevice[];
  beforeAll(async () => {
    t = await createTestApp(); await truncateAll(t.ds);
    family = await seedFamily(t.app, t.ds, '10.94.0');
    clients = [family.owner, ...await Promise.all(Array.from({ length: 19 }, () => addDeviceForActor(t.app, family.owner.actorId)))];
    const spaceId = family.space.spaceId;
    for (let batch = 0; batch < 20; batch++) {
      const created = await sendOps(family.owner, spaceId, Array.from({ length: 25 }, (_, index) => {
        const id = randomUUID(); return op({ resource_type: 'item', resource_id: id, action: 'create', payload: itemPayload(spaceId, family.owner.actorId, { id, title: `API workload ${batch * 25 + index}` }) });
      }));
      expect(created.status).toBe(200); expect(created.body.results.every((row: { status: string }) => row.status === 'APPLIED')).toBe(true);
    }
    const privateId = randomUUID();
    const hidden = await sendOps(family.adult, spaceId, [op({ resource_type: 'item', resource_id: privateId, action: 'create', payload: itemPayload(spaceId, family.adult.actorId, { id: privateId, sharingScope: 'PRIVATE', title: 'Private performance sentinel' }) })]);
    expect(hidden.body.results[0].status).toBe('APPLIED');
  });
  afterAll(() => t.close());
  it('keeps p95 below one second with 20 authenticated devices and verifies every snapshot', async () => {
    const spaceId = family.space.spaceId;
    const durations: number[] = [];
    const changes: number[] = [];
    const operations: number[] = [];
    for (let round = 0; round < 5; round++) {
      await Promise.all(clients.map(async (client) => {
        const started = performance.now();
        const response = await client.agent.get(`/api/v1/spaces/${spaceId}/sync/snapshot`);
        durations.push(performance.now() - started);
        expect(response.status).toBe(200);
        const items = response.body.records.item as Array<{ id: string; title: string }>;
        expect(items).toHaveLength(500); expect(new Set(items.map((row) => row.id)).size).toBe(500);
        expect(items.every((row) => row.title.startsWith('API workload'))).toBe(true);
        const changedAt = performance.now();
        const delta = await client.agent.get(`/api/v1/spaces/${spaceId}/sync/changes`).query({ cursor: response.body.watermark, limit: 100 });
        changes.push(performance.now() - changedAt);
        expect(delta.status).toBe(200); expect(delta.body.changes).toEqual([]);
      }));
    }
    for (let round = 0; round < 5; round++) await Promise.all(clients.map(async (client, index) => {
      const id = randomUUID(); const started = performance.now();
      const response = await sendOps(client, spaceId, [op({ resource_type: 'item', resource_id: id, action: 'create', payload: itemPayload(spaceId, family.owner.actorId, { id, title: `Concurrent operation ${round}:${index}` }) })]);
      operations.push(performance.now() - started);
      expect(response.status).toBe(200); expect(response.body.results[0]).toMatchObject({ status: 'APPLIED', record: { id } });
    }));
    const final = await family.owner.agent.get(`/api/v1/spaces/${spaceId}/sync/snapshot`);
    expect(final.status).toBe(200); expect(final.body.records.item).toHaveLength(600);
    expect((final.body.records.item as Array<{ title: string }>).some((row) => row.title === 'Private performance sentinel')).toBe(false);
    const report = { devices: clients.length, concurrency: 20, records: 500, samples: durations.length, snapshotP95Ms: percentile(durations), changesP95Ms: percentile(changes), operationsP95Ms: percentile(operations), unexpectedServerErrors: 0, dataLoss: 0, accessLeaks: 0, samplesMs: { snapshots: durations, changes, operations } };
    if (process.env.QA_API_PERFORMANCE_OUTPUT) {
      const path = resolve(process.env.QA_API_PERFORMANCE_OUTPUT); mkdirSync(resolve(path, '..'), { recursive: true }); writeFileSync(path, JSON.stringify(report, null, 2) + '\n', 'utf8');
    }
    expect(report.snapshotP95Ms).toBeLessThanOrEqual(1000); expect(report.changesP95Ms).toBeLessThanOrEqual(1000);
    expect(report.operationsP95Ms).toBeLessThanOrEqual(1000);
  });
});
