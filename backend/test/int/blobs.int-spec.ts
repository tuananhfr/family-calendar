import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import request from 'supertest';
import { withTransaction } from '../../src/database/transaction';
import { AccessService } from '../../src/modules/access/access.service';
import { truncateAll } from '../helpers/db';
import { registerDevice, type RegisteredDevice } from '../helpers/session';
import { createSharedSpace } from '../helpers/spaces';
import { base, op, seedFamily, sendOps, type Family } from '../helpers/sync';
import { createTestApp, type TestApp } from '../helpers/test-app';

const STORAGE_DIR = 'var/test-storage';
const MB = 1024 * 1024;
const MARKER = Buffer.from('SO-DO-NHA-BI-MAT-CUA-GIA-DINH');

function sha(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex');
}

function filesUnder(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? filesUnder(p) : [p];
  });
}

/** Plaintext that is easy to grep for: the marker repeated through random filler. */
function sample(bytes: number): Buffer {
  const out = randomBytes(bytes);
  for (let at = 0; at + MARKER.length <= bytes; at += 64 * 1024) MARKER.copy(out, at);
  return out;
}

describe('encrypted file blobs (int)', () => {
  let t: TestApp;
  let f: Family;
  let spaceId: string;
  let folderId: string;

  beforeAll(async () => {
    process.env.STORAGE_MAX_FILE_BYTES = String(4 * MB);
    process.env.STORAGE_MAX_VIDEO_BYTES = String(5 * MB);
    t = await createTestApp();
  });

  beforeEach(async () => {
    await truncateAll(t.ds);
    rmSync(STORAGE_DIR, { recursive: true, force: true });
    f = await seedFamily(t.app, t.ds, '10.70.0');
    spaceId = f.space.spaceId;
    const folder = { ...base(spaceId, f.owner.actorId), name: 'Giấy tờ nhà', parentId: null };
    folderId = folder.id;
    expect(
      (
        await sendOps(f.owner, spaceId, [
          op({ resource_type: 'folder', resource_id: folder.id, action: 'create', payload: folder }),
        ])
      ).body.results[0].status,
    ).toBe('APPLIED');
  });

  afterAll(async () => {
    rmSync(STORAGE_DIR, { recursive: true, force: true });
    delete process.env.STORAGE_MAX_FILE_BYTES;
    delete process.env.STORAGE_MAX_VIDEO_BYTES;
    await t.close();
  });

  async function fileRecord(
    data: Buffer,
    kind = 'IMAGE',
    mime = 'image/jpeg',
    name = 'so-do nhà.jpg',
  ): Promise<string> {
    const file = {
      ...base(spaceId, f.owner.actorId),
      folderId,
      name,
      mime,
      size: data.length,
      sha256: sha(data),
      kind,
      blobState: 'UPLOADING',
    };
    const res = await sendOps(f.owner, spaceId, [
      op({ resource_type: 'file', resource_id: file.id, action: 'create', payload: file }),
    ]);
    expect(res.body.results[0].status).toBe('APPLIED');
    return file.id;
  }

  function upload(
    dev: RegisteredDevice,
    fileId: string,
    data: Buffer,
    opts: { sha?: string; mime?: string; space?: string } = {},
  ) {
    return (
      dev.agent
        .post(`/api/v1/spaces/${opts.space ?? spaceId}/files/${fileId}/blob`)
        .set('X-CSRF-Token', dev.csrf)
        .set('Content-Type', opts.mime ?? 'image/jpeg')
        .set('X-Content-SHA256', opts.sha ?? sha(data))
        // superagent would JSON-encode a Buffer sent as application/json; a browser fetch sends the bytes as they are.
        .serialize((body: Buffer) => body as unknown as string)
        .send(data)
    );
  }

  function download(dev: RegisteredDevice, fileId: string, space = spaceId) {
    return dev.agent
      .get(`/api/v1/spaces/${space}/files/${fileId}/blob`)
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      });
  }

  it('round-trips 3 MB byte-for-byte, stores only ciphertext and marks the file SYNCED', async () => {
    const data = sample(3 * MB);
    const fileId = await fileRecord(data);
    const put = await upload(f.owner, fileId, data);
    expect(put.status).toBe(201);
    expect(put.body).toEqual({ blob_state: 'SYNCED' });

    const onDisk = filesUnder(STORAGE_DIR);
    expect(onDisk).toHaveLength(1);
    const stored = readFileSync(onDisk[0]);
    expect(stored.length).toBe(data.length);
    expect(stored.includes(MARKER)).toBe(false);

    const snap = await f.adult.agent.get(`/api/v1/spaces/${spaceId}/sync/snapshot`);
    const rec = snap.body.records.file.find((r: { id: string }) => r.id === fileId);
    expect(rec).toMatchObject({ blobState: 'SYNCED', revision: '2' });

    for (const dev of [f.owner, f.child]) {
      const got = await download(dev, fileId);
      expect(got.status).toBe(200);
      expect((got.body as Buffer).equals(data)).toBe(true);
      expect(got.headers['content-type']).toBe('image/jpeg');
      expect(got.headers['cache-control']).toBe('private, no-store');
      expect(got.headers['content-disposition']).toMatch(/^attachment;/);
      expect(got.headers['content-disposition']).toContain("filename*=UTF-8''so-do%20nh%C3%A0.jpg");
    }
  });

  it('rejects a wrong hash with 422 and leaves no temporary file behind', async () => {
    const data = sample(64 * 1024);
    const fileId = await fileRecord(data);
    const notMeta = await upload(f.owner, fileId, data, { sha: 'a'.repeat(64) });
    expect(notMeta.status).toBe(422);
    const altered = Buffer.from(data);
    altered[10] ^= 1;
    const bodyMismatch = await upload(f.owner, fileId, altered, { sha: sha(data) });
    expect(bodyMismatch.status).toBe(422);
    expect(bodyMismatch.body.error.fields).toEqual({ sha256: 'MISMATCH' });
    expect(filesUnder(STORAGE_DIR)).toEqual([]);
    expect((await download(f.owner, fileId)).status).toBe(404);

    // A JSON document is still a raw blob, not a request body for the JSON parser.
    const json = Buffer.from(JSON.stringify({ ghiChu: 'giấy tờ nhà' }));
    const jsonId = await fileRecord(json, 'DOCUMENT', 'application/json', 'ghi-chu.json');
    const jsonPut = await upload(f.owner, jsonId, json, { mime: 'application/json' });
    expect(jsonPut.body).toEqual({ blob_state: 'SYNCED' });
    expect(((await download(f.owner, jsonId)).body as Buffer).equals(json)).toBe(true);
  });

  it('caps uploads by kind with 413 (image and video limits from config)', async () => {
    const image = sample(4 * MB + 1);
    const tooBigImage = await upload(f.owner, await fileRecord(image), image);
    expect(tooBigImage.status).toBe(413);
    expect(tooBigImage.body.error.code).toBe('PAYLOAD_TOO_LARGE');

    const video = sample(5 * MB + 1);
    const videoId = await fileRecord(video, 'VIDEO', 'video/mp4', 'clip.mp4');
    expect((await upload(f.owner, videoId, video, { mime: 'video/mp4' })).status).toBe(413);
    const fits = sample(4 * MB + 10);
    const fitsId = await fileRecord(fits, 'VIDEO', 'video/mp4', 'ok.mp4');
    expect((await upload(f.owner, fitsId, fits, { mime: 'video/mp4' })).status).toBe(201);
    expect(filesUnder(STORAGE_DIR)).toHaveLength(1);
  });

  it('checks storage permission on every request and never serves a Family file through a Group (STO-001, ISO-001)', async () => {
    const data = sample(32 * 1024);
    const fileId = await fileRecord(data);
    expect((await upload(f.owner, fileId, data)).status).toBe(201);

    // MEMBER has storage VIEW only.
    expect((await upload(f.child, fileId, data)).status).toBe(403);

    const access = t.app.get(AccessService);
    const guest = await registerDevice(t.app, { ip: '10.71.0.1' });
    await withTransaction(t.ds, (em) => access.addMembership(em, spaceId, guest.actorId, f.space.roleIds.GUEST));
    const denied = await download(guest, fileId);
    expect(denied.status).toBe(403);
    expect(JSON.parse((denied.body as Buffer).toString('utf8')).error.code).toBe('FORBIDDEN');

    const group = await createSharedSpace(
      t.ds,
      access,
      {
        sessionId: randomUUID(),
        actorId: f.adult.actorId,
        deviceId: f.adult.deviceId,
        accountId: null,
      },
      'GROUP',
    );
    const viaGroup = await download(f.adult, fileId, group.spaceId);
    expect(viaGroup.status).toBe(404);
    expect((viaGroup.body as Buffer).includes(MARKER)).toBe(false);
    expect((await upload(f.adult, fileId, data, { space: group.spaceId })).status).toBe(404);

    const anonymous = await request(t.app.getHttpServer()).get(`/api/v1/spaces/${spaceId}/files/${fileId}/blob`);
    expect(anonymous.status).toBe(401);
  });

  it('refuses to serve a blob whose ciphertext was altered', async () => {
    const data = sample(256 * 1024);
    const fileId = await fileRecord(data);
    expect((await upload(f.owner, fileId, data)).status).toBe(201);
    const [path] = filesUnder(STORAGE_DIR);
    const stored = readFileSync(path);
    stored[1000] ^= 1;
    writeFileSync(path, stored);

    const got = await download(f.owner, fileId);
    expect(got.status).toBe(500);
    const body = got.body as Buffer;
    expect(body.length).toBeLessThan(1024);
    expect(JSON.parse(body.toString('utf8')).error.code).toBe('BLOB_CORRUPT');
  });
});
