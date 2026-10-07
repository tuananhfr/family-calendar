import { isLocalDateTime } from '../../../common/time/zoned';
import { FILE_KINDS, MAX_FILE_BYTES } from '../domain-enums';
import { id, int, oneOf, plain, text, type Codec } from '../fields';
import { capabilityRules } from '../record-access';
import { TableResource } from '../resource-definition';

const takenAt: Codec<string> = {
  parse(v, path, e) {
    return isLocalDateTime(v) ? v : e.add(path, 'INVALID_DATETIME');
  },
  out: (raw) => raw,
};

/**
 * File metadata only; the encrypted blob travels through /files/:fileId/blob. `blobState` SYNCED is a server
 * fact: a client cannot claim it, and once the blob is stored a metadata edit cannot downgrade it.
 */
export const fileDefinition = new TableResource({
  type: 'file',
  table: 'files',
  access: capabilityRules('storage'),
  immutable: ['sha256', 'size'],
  fields: [
    { key: 'folderId', column: 'folder_id', codec: id },
    { key: 'name', column: 'name', codec: text(255) },
    { key: 'mime', column: 'mime', codec: plain(127, 1, /^[\x21-\x7e]+$/) },
    { key: 'size', column: 'size', codec: int(0, Number.MAX_SAFE_INTEGER) },
    { key: 'sha256', column: 'sha256', codec: plain(64, 64, /^[0-9a-f]{64}$/) },
    { key: 'kind', column: 'kind', codec: oneOf(FILE_KINDS) },
    { key: 'thumbnailBlobId', column: 'thumbnail_blob_id', codec: plain(64, 1, /^[\x21-\x7e]+$/), optional: true },
    { key: 'takenAt', column: 'taken_at', codec: takenAt, nullable: true },
    {
      key: 'blobState',
      column: 'blob_state',
      codec: oneOf(['LOCAL_ONLY', 'UPLOADING', 'SYNCED', 'MISSING'] as const),
    },
  ],
  refs: [{ key: 'folderId', table: 'folders' }],
  validate(_input, columns, e) {
    const kind = columns.kind as keyof typeof MAX_FILE_BYTES;
    if ((columns.size as number) > MAX_FILE_BYTES[kind]) e.add('size', 'FILE_TOO_LARGE');
  },
  derive(columns, ctx) {
    if (ctx.existing?.blob_state === 'SYNCED') return { blob_state: 'SYNCED' };
    return columns.blob_state === 'SYNCED' ? { blob_state: 'MISSING' } : {};
  },
});
