import { Column, Entity, PrimaryColumn } from 'typeorm';

/** Where a file's ciphertext lives and the wrapped key that opens it (TEC-17). */
@Entity({ name: 'file_blobs' })
export class FileBlobEntity {
  @PrimaryColumn({ name: 'space_id', type: 'char', length: 36 }) spaceId: string;
  @PrimaryColumn({ name: 'file_id', type: 'char', length: 36 }) fileId: string;
  @Column({ name: 'storage_key', type: 'varchar', length: 200 }) storageKey: string;
  @Column({ type: 'bigint', unsigned: true }) size: string;
  @Column({ type: 'char', length: 64 }) sha256: string;
  @Column({ name: 'content_type', type: 'varchar', length: 127 }) contentType: string;
  @Column({ name: 'wrapped_key', type: 'varbinary', length: 64 }) wrappedKey: Buffer;
  @Column({ type: 'binary', length: 12 }) iv: Buffer;
  @Column({ name: 'auth_tag', type: 'binary', length: 16 }) authTag: Buffer;
  @Column({ name: 'created_at', type: 'datetime', precision: 3 }) createdAt: Date;
}
