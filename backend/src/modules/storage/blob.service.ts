import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import type { FileHandle } from 'node:fs/promises';
import { Transform, Writable, type Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, type EntityManager } from 'typeorm';
import { decryptStream, encryptStream, newDataKey, unwrapKey, wrapKey } from '../../common/crypto/file-cipher';
import { ApiError } from '../../common/errors/api-error';
import { ErrorCode } from '../../common/errors/error-codes';
import type { SessionContext } from '../../common/http/current-session.decorator';
import { isClientId } from '../../common/ids';
import type { AppConfig } from '../../config/configuration';
import { withTransaction } from '../../database/transaction';
import { AccessService } from '../access/access.service';
import { hasLevel } from '../access/evaluate-access';
import { recordAudit } from '../audit/record-audit';
import { appendChange, lockSpace } from '../sync/change-log';
import type { StoredRow } from '../sync/resource-definition';
import { RESOURCE_REGISTRY } from '../sync/resource-registry';
import { LocalDiskStorage } from './local-disk.storage';

interface BlobRow {
  storage_key: string;
  size: string;
  content_type: string;
  wrapped_key: Buffer;
  iv: Buffer;
  auth_tag: Buffer;
}

export interface UploadHeaders {
  sha256?: string;
  contentLength?: number;
}

export interface OpenedBlob {
  name: string;
  contentType: string;
  size: number;
  /** Plaintext stream; the whole ciphertext already passed authentication before this was handed out. */
  stream(): NodeJS.ReadableStream;
  close(): Promise<void>;
}

const notFound = () => new ApiError(ErrorCode.NOT_FOUND, 404);
const mismatch = (field: 'sha256' | 'size') =>
  new ApiError(ErrorCode.VALIDATION_FAILED, 422, 'Tệp tải lên không khớp với thông tin đã khai báo.', {
    [field]: 'MISMATCH',
  });
const tooLarge = () => new ApiError(ErrorCode.PAYLOAD_TOO_LARGE, 413, 'Tệp vượt quá dung lượng cho phép.');
const corrupt = () => new ApiError(ErrorCode.BLOB_CORRUPT, 500);

/** How much of a rejected upload is still read so the client receives the error response instead of a reset. */
const DRAIN_LIMIT_BYTES = 32 * 1024 * 1024;

async function drain(body: Readable): Promise<void> {
  if (body.readableEnded || body.destroyed) return;
  await new Promise<void>((resolve) => {
    let seen = 0;
    const finish = () => {
      body.off('data', onData);
      body.off('end', finish);
      body.off('error', finish);
      body.off('close', finish);
      resolve();
    };
    const onData = (chunk: Buffer) => {
      seen += chunk.length;
      if (seen > DRAIN_LIMIT_BYTES) {
        body.destroy();
        finish();
      }
    };
    body.on('data', onData);
    body.once('end', finish);
    body.once('error', finish);
    body.once('close', finish);
    body.resume();
  });
}

/** Binds ciphertext and wrapped key to one record, so neither can be replayed onto another file. */
function aadFor(spaceId: string, fileId: string): string {
  return `file-blob:${spaceId}/${fileId}`;
}

@Injectable()
export class BlobService {
  private readonly logger = new Logger(BlobService.name);
  private readonly masterKey: Buffer;
  private readonly limits: { fileBytes: number; videoBytes: number };

  constructor(
    private readonly ds: DataSource,
    private readonly access: AccessService,
    private readonly storage: LocalDiskStorage,
    config: ConfigService<AppConfig, true>,
  ) {
    this.masterKey = Buffer.from(config.get('storageMasterKey', { infer: true }), 'hex');
    this.limits = config.get('storageLimits', { infer: true });
  }

  async upload(
    session: SessionContext,
    spaceId: string,
    fileId: string,
    body: Readable,
    headers: UploadHeaders,
  ): Promise<{ blob_state: 'SYNCED' }> {
    try {
      return await this.store(session, spaceId, fileId, body, headers);
    } catch (err) {
      await drain(body);
      throw err;
    }
  }

  private async store(
    session: SessionContext,
    spaceId: string,
    fileId: string,
    body: Readable,
    headers: UploadHeaders,
  ): Promise<{ blob_state: 'SYNCED' }> {
    const file = await withTransaction(this.ds, (em) => this.authorize(em, session, spaceId, fileId, 'write'));
    if (typeof headers.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(headers.sha256)) {
      throw new ApiError(ErrorCode.VALIDATION_FAILED, 422, undefined, { sha256: 'INVALID' });
    }
    if (headers.sha256 !== file.sha256) throw mismatch('sha256');
    const cap = file.kind === 'VIDEO' ? this.limits.videoBytes : this.limits.fileBytes;
    const declared = Number(file.size);
    if (declared > cap || (headers.contentLength ?? 0) > cap) throw tooLarge();

    const dataKey = newDataKey();
    const aad = aadFor(spaceId, fileId);
    const enc = encryptStream(dataKey, aad);
    const hash = createHash('sha256');
    let received = 0;
    // Past the cap the rest is read and dropped rather than failing the stream: failing would reset the connection
    // and the client would see a network error instead of 413. Beyond DRAIN_LIMIT_BYTES it is cut off anyway.
    const meter = new Transform({
      transform(chunk: Buffer, _enc, cb) {
        received += chunk.length;
        if (received > cap + DRAIN_LIMIT_BYTES) return cb(tooLarge());
        if (received > cap) return cb();
        hash.update(chunk);
        cb(null, chunk);
      },
    });
    const temp = await this.storage.tempPath();
    try {
      await pipeline(body, meter, enc.cipher, createWriteStream(temp));
    } catch (err) {
      await this.storage.discard(temp);
      throw err instanceof ApiError ? err : new ApiError(ErrorCode.VALIDATION_FAILED, 422, 'Tải tệp lên bị gián đoạn.');
    }
    if (received > cap) {
      await this.storage.discard(temp);
      throw tooLarge();
    }
    if (hash.digest('hex') !== file.sha256) {
      await this.storage.discard(temp);
      throw mismatch('sha256');
    }
    if (received !== declared) {
      await this.storage.discard(temp);
      throw mismatch('size');
    }

    const key = this.storage.newKey(spaceId, fileId);
    await this.storage.commit(temp, key);
    let previousKey: string | undefined;
    try {
      previousKey = await withTransaction(this.ds, (em) =>
        this.record(em, session, spaceId, fileId, {
          key,
          size: received,
          contentType: String(file.mime),
          wrappedKey: wrapKey(this.masterKey, dataKey, aad),
          iv: enc.iv,
          authTag: enc.getAuthTag(),
        }),
      );
    } catch (err) {
      await this.storage.remove(key);
      throw err;
    }
    if (previousKey && previousKey !== key) {
      await this.storage.remove(previousKey).catch(() => this.logger.warn('could not remove a replaced blob'));
    }
    return { blob_state: 'SYNCED' };
  }

  /** Permission is checked on every download; nothing about the file is cacheable or addressable without it. */
  async open(session: SessionContext, spaceId: string, fileId: string): Promise<OpenedBlob> {
    const { file, blob } = await withTransaction(this.ds, async (em) => {
      const row = await this.authorize(em, session, spaceId, fileId, 'read');
      const [b]: BlobRow[] = await em.query(
        'SELECT storage_key, size, content_type, wrapped_key, iv, auth_tag FROM file_blobs WHERE space_id = ? AND file_id = ?',
        [spaceId, fileId],
      );
      if (!b) throw notFound();
      return { file: row, blob: b };
    });

    const aad = aadFor(spaceId, fileId);
    let dataKey: Buffer;
    let handle: FileHandle;
    try {
      dataKey = unwrapKey(this.masterKey, blob.wrapped_key, aad);
      handle = await this.storage.open(blob.storage_key);
    } catch {
      this.logger.warn('stored blob could not be opened');
      throw corrupt();
    }
    const decrypt = () =>
      handle.createReadStream({ start: 0, autoClose: false }).pipe(decryptStream(dataKey, blob.iv, blob.auth_tag, aad));
    // GCM authenticates only at the end, so a full verifying pass runs before any plaintext leaves the server.
    try {
      await pipeline(
        handle.createReadStream({ start: 0, autoClose: false }),
        decryptStream(dataKey, blob.iv, blob.auth_tag, aad),
        new Writable({ write: (_chunk, _enc, cb) => cb() }),
      );
    } catch {
      await handle.close();
      this.logger.warn('stored blob failed authentication');
      throw corrupt();
    }
    return {
      name: String(file.name),
      contentType: blob.content_type,
      size: Number(blob.size),
      stream: decrypt,
      close: () => handle.close(),
    };
  }

  /**
   * 404 for anything the caller cannot see in this Space (unknown, deleted, another Space's file — ISO-001), 403
   * when the role has no storage access at all or may read but not write.
   */
  private async authorize(
    em: EntityManager,
    session: SessionContext,
    spaceId: string,
    fileId: string,
    mode: 'read' | 'write',
  ): Promise<StoredRow> {
    if (!isClientId(spaceId) || !isClientId(fileId)) throw notFound();
    const ctx = await this.access.loadContext(session, spaceId, em);
    if (!hasLevel(ctx, 'storage', 'VIEW')) throw new ApiError(ErrorCode.FORBIDDEN, 403);
    const def = RESOURCE_REGISTRY.file;
    const [row] = await def.find(em, spaceId, [fileId]);
    if (!row || row.deleted_at || !def.access.canRead(ctx, row, null)) throw notFound();
    if (mode === 'write' && !def.access.canWrite(ctx, row, null)) throw new ApiError(ErrorCode.FORBIDDEN, 403);
    return row;
  }

  /** Stores the key material and flips the record to SYNCED under the Space lock; returns the replaced blob key. */
  private async record(
    em: EntityManager,
    session: SessionContext,
    spaceId: string,
    fileId: string,
    blob: { key: string; size: number; contentType: string; wrappedKey: Buffer; iv: Buffer; authTag: Buffer },
  ): Promise<string | undefined> {
    await lockSpace(em, spaceId);
    const file = await this.authorize(em, session, spaceId, fileId, 'write');
    const [previous]: Array<{ storage_key: string }> = await em.query(
      'SELECT storage_key FROM file_blobs WHERE space_id = ? AND file_id = ? FOR UPDATE',
      [spaceId, fileId],
    );
    await em.query(
      `INSERT INTO file_blobs (space_id, file_id, storage_key, size, sha256, content_type, wrapped_key, iv, auth_tag, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(3))
       ON DUPLICATE KEY UPDATE storage_key = VALUES(storage_key), size = VALUES(size), sha256 = VALUES(sha256),
         content_type = VALUES(content_type), wrapped_key = VALUES(wrapped_key), iv = VALUES(iv),
         auth_tag = VALUES(auth_tag), created_at = VALUES(created_at)`,
      [spaceId, fileId, blob.key, blob.size, file.sha256, blob.contentType, blob.wrappedKey, blob.iv, blob.authTag],
    );
    if (file.blob_state !== 'SYNCED') {
      const now = new Date();
      const revision = (BigInt(String(file.revision)) + 1n).toString();
      await em.query(
        "UPDATE files SET blob_state = 'SYNCED', revision = ?, updated_at = ? WHERE space_id = ? AND id = ?",
        [revision, now, spaceId, fileId],
      );
      await appendChange(em, spaceId, 'file', fileId, revision, 'UPSERT', now);
    }
    await recordAudit(em, {
      spaceId,
      actorId: session.actorId,
      deviceId: session.deviceId,
      action: 'file.blob_upload',
      resourceType: 'file',
      resourceId: fileId,
    });
    return previous?.storage_key;
  }
}
