import { Column, Entity } from 'typeorm';
import { ResourceEntity } from '../../../database/resource-entity';

/** File metadata only; the blob is stored separately (modules.md §9). */
@Entity({ name: 'files' })
export class FileEntity extends ResourceEntity {
  @Column({ name: 'folder_id', type: 'char', length: 36 }) folderId: string;
  @Column({ type: 'varchar', length: 255 }) name: string;
  @Column({ type: 'varchar', length: 127 }) mime: string;
  @Column({ type: 'bigint', unsigned: true }) size: string;
  @Column({ type: 'char', length: 64 }) sha256: string;
  @Column({ type: 'enum', enum: ['IMAGE', 'DOCUMENT', 'VIDEO', 'AUDIO', 'OTHER'] }) kind:
    'IMAGE' | 'DOCUMENT' | 'VIDEO' | 'AUDIO' | 'OTHER';
  @Column({ name: 'thumbnail_blob_id', type: 'varchar', length: 64, nullable: true }) thumbnailBlobId: string | null;
  /** EXIF wall-clock time; GPS coordinates are never stored. */
  @Column({ name: 'taken_at', type: 'char', length: 16, nullable: true }) takenAt: string | null;
  @Column({ name: 'blob_state', type: 'enum', enum: ['LOCAL_ONLY', 'UPLOADING', 'SYNCED', 'MISSING'] }) blobState:
    'LOCAL_ONLY' | 'UPLOADING' | 'SYNCED' | 'MISSING';
}
