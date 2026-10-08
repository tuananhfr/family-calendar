import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, type EntityManager } from 'typeorm';
import type { Readable } from 'node:stream';
import type { AppConfig } from '../../config/configuration';
import { encryptStream, decryptStream, newDataKey, wrapKey, unwrapKey } from '../../common/crypto/file-cipher';
import { ApiError } from '../../common/errors/api-error';
import { ErrorCode } from '../../common/errors/error-codes';
import type { SessionContext } from '../../common/http/current-session.decorator';
import { isClientId } from '../../common/ids';
import { withTransaction } from '../../database/transaction';
import { AccessService } from '../access/access.service';
import { RESOURCE_REGISTRY } from '../sync/resource-registry';
import { lockSpace } from '../sync/change-log';
import { LocalDiskStorage } from './local-disk.storage';
export type MediaKind = 'member' | 'item' | 'reminder';
interface Owner { kind: 'member' | 'item'; id: string; }
interface MediaRow {
  storage_key: string; size: string; sha256: string; content_type: string;
  wrapped_key: Buffer; iv: Buffer; auth_tag: Buffer;
}
const missing = () => new ApiError(ErrorCode.NOT_FOUND, 404);
const imageTypes = ['image/jpeg', 'image/png', 'image/webp'];
const audioTypes = ['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/x-wav'];
@Injectable()
export class MediaService {
  private readonly master: Buffer;
  constructor(private readonly ds: DataSource, private readonly access: AccessService,
    private readonly storage: LocalDiskStorage, config: ConfigService<AppConfig, true>) {
    this.master = Buffer.from(config.get('storageMasterKey', { infer: true }), 'hex');
  }
  private async authorize(session: SessionContext, spaceId: string, kind: MediaKind, recordId: string,
    assetId: string, write: boolean, em: EntityManager = this.ds.manager): Promise<Owner> {
    if (![spaceId, recordId, assetId].every(isClientId) || !['member', 'item', 'reminder'].includes(kind)) throw missing();
    const ctx = await this.access.loadContext(session, spaceId, em);
    const def = kind === 'member' ? RESOURCE_REGISTRY.member : kind === 'item' ? RESOURCE_REGISTRY.item : RESOURCE_REGISTRY.reminder_rule;
    const [row] = await def.find(em, spaceId, [recordId]);
    if (!row || row.deleted_at) throw missing();
    const reference = kind === 'member' ? row.avatar : row.audio_asset_id;
    if (reference !== (kind === 'member' ? 'blob:' + assetId : assetId)) throw missing();
    const parent = kind === 'reminder' ? (await RESOURCE_REGISTRY.item.find(em, spaceId, [row.item_id as string]))[0] : null;
    if (kind === 'reminder' && (!parent || parent.deleted_at)) throw missing();
    const allowed = write ? def.access.canWrite(ctx, row, parent) : def.access.canRead(ctx, row, parent);
    if (!allowed) throw new ApiError(ErrorCode.FORBIDDEN, 403);
    return { kind: kind === 'member' ? 'member' : 'item', id: kind === 'reminder' ? row.item_id as string : recordId };
  }
  private async row(spaceId: string, owner: Owner, assetId: string, em = this.ds.manager): Promise<MediaRow | undefined> {
    const [row]: MediaRow[] = await em.query('SELECT * FROM shared_media WHERE space_id = ? AND owner_kind = ? AND owner_id = ? AND asset_id = ?',
      [spaceId, owner.kind, owner.id, assetId]);
    return row;
  }
  async info(session: SessionContext, spaceId: string, kind: MediaKind, recordId: string, assetId: string) {
    const owner = await this.authorize(session, spaceId, kind, recordId, assetId, false);
    const row = await this.row(spaceId, owner, assetId);
    if (!row) throw missing();
    return { size: Number(row.size), mime: row.content_type, sha256: row.sha256 };
  }
  async upload(session: SessionContext, spaceId: string, kind: MediaKind, recordId: string, assetId: string,
    body: Readable, mimeHeader: string, expectedHash: string) {
    await this.authorize(session, spaceId, kind, recordId, assetId, true);
    const mime = mimeHeader.split(';')[0].trim().toLowerCase();
    if (!(kind === 'member' ? imageTypes : audioTypes).includes(mime) || !/^[a-f0-9]{64}$/.test(expectedHash))
      throw new ApiError(ErrorCode.VALIDATION_FAILED, 422);
    const max = kind === 'member' ? 5 * 1024 * 1024 : 25 * 1024 * 1024;
    const pieces: Buffer[] = []; let size = 0;
    for await (const piece of body) {
      const bytes = Buffer.isBuffer(piece) ? piece : Buffer.from(piece as Uint8Array);
      size += bytes.length;
      if (size > max) throw new ApiError(ErrorCode.PAYLOAD_TOO_LARGE, 413);
      pieces.push(bytes);
    }
    const bytes = Buffer.concat(pieces);
    if (!size || createHash('sha256').update(bytes).digest('hex') !== expectedHash) throw new ApiError(ErrorCode.VALIDATION_FAILED, 422);
    if (kind === 'member') {
      const valid = mime === 'image/webp' ? bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP'
        : mime === 'image/png' ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
      if (!valid) throw new ApiError(ErrorCode.VALIDATION_FAILED, 422);
    }
    const owner = await this.authorize(session, spaceId, kind, recordId, assetId, true);
    const aad = 'shared-media:' + spaceId + '/' + owner.kind + '/' + owner.id + '/' + assetId;
    const key = newDataKey(), seal = encryptStream(key, aad);
    const encrypted = Buffer.concat([seal.cipher.update(bytes), seal.cipher.final()]);
    const tag = seal.getAuthTag(), wrapped = wrapKey(this.master, key, aad);
    const temp = await this.storage.tempPath(), storageKey = this.storage.newKey(spaceId, assetId);
    let committed = false;
    try {
      await writeFile(temp, encrypted, { flag: 'wx' });
      await withTransaction(this.ds, async (em) => {
        await lockSpace(em, spaceId);
        await this.authorize(session, spaceId, kind, recordId, assetId, true, em);
        const existing = await this.row(spaceId, owner, assetId, em);
        if (existing) {
          if (existing.sha256 !== expectedHash) throw new ApiError(ErrorCode.ID_COLLISION, 409);
          return;
        }
        await this.storage.commit(temp, storageKey); committed = true;
        await em.query('INSERT INTO shared_media (space_id, owner_kind, owner_id, asset_id, storage_key, size, sha256, content_type, wrapped_key, iv, auth_tag, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(3))',
          [spaceId, owner.kind, owner.id, assetId, storageKey, size, expectedHash, mime, wrapped, seal.iv, tag]);
      });
      return { stored: true };
    } catch (err) {
      if (committed) await this.storage.remove(storageKey);
      throw err;
    } finally { if (!committed) await this.storage.discard(temp); }
  }
  async open(session: SessionContext, spaceId: string, kind: MediaKind, recordId: string, assetId: string) {
    const owner = await this.authorize(session, spaceId, kind, recordId, assetId, false);
    const row = await this.row(spaceId, owner, assetId);
    if (!row) throw missing();
    const handle = await this.storage.open(row.storage_key);
    let encrypted: Buffer;
    try { encrypted = await readFile(handle); } finally { await handle.close(); }
    const aad = 'shared-media:' + spaceId + '/' + owner.kind + '/' + owner.id + '/' + assetId;
    let bytes: Buffer;
    try {
      const key = unwrapKey(this.master, row.wrapped_key, aad);
      const decrypt = decryptStream(key, row.iv, row.auth_tag, aad);
      bytes = Buffer.concat([decrypt.update(encrypted), decrypt.final()]);
      if (bytes.length !== Number(row.size) || createHash('sha256').update(bytes).digest('hex') !== row.sha256) throw new Error();
    } catch { throw new ApiError(ErrorCode.BLOB_CORRUPT, 500); }
    await this.authorize(session, spaceId, kind, recordId, assetId, false);
    return { bytes, mime: row.content_type };
  }
}
