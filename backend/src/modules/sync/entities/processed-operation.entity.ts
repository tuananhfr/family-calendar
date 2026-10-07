import { Column, Entity, PrimaryColumn } from 'typeorm';

/** Idempotency record of one client operation; `result` is null while the first attempt is applying it. */
@Entity({ name: 'processed_operations' })
export class ProcessedOperationEntity {
  @PrimaryColumn({ name: 'operation_id', type: 'char', length: 36 }) operationId: string;
  @Column({ name: 'device_id', type: 'char', length: 36 }) deviceId: string;
  @Column({ name: 'space_id', type: 'char', length: 36 }) spaceId: string;
  @Column({ name: 'payload_hash', type: 'char', length: 64 }) payloadHash: string;
  @Column({ type: 'json', nullable: true }) result: Record<string, unknown> | null;
  @Column({ name: 'created_at', type: 'datetime', precision: 3 }) createdAt: Date;
}
