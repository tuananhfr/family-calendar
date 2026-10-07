import { Column, Entity, PrimaryColumn } from 'typeorm';

/** A bootstrap chunk already applied to an INITIALIZING Space (idempotency by chunk_id). */
@Entity({ name: 'bootstrap_chunks' })
export class BootstrapChunkEntity {
  @PrimaryColumn({ name: 'chunk_id', type: 'char', length: 36 }) chunkId: string;
  @Column({ name: 'space_id', type: 'char', length: 36 }) spaceId: string;
  @Column({ name: 'payload_hash', type: 'char', length: 64 }) payloadHash: string;
  @Column({ type: 'int', unsigned: true }) accepted: number;
  @Column({ name: 'created_at', type: 'datetime', precision: 3 }) createdAt: Date;
}
