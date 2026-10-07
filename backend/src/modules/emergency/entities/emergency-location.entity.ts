import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export const LOCATION_PROVENANCES = ['CURRENT', 'LAST_KNOWN'] as const;
export type LocationProvenance = (typeof LOCATION_PROVENANCES)[number];

@Entity({ name: 'emergency_locations' })
export class EmergencyLocationEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true }) id: string;
  @Column({ name: 'event_id', type: 'char', length: 36 }) eventId: string;
  @Column({ name: 'actor_id', type: 'char', length: 36 }) actorId: string;
  @Column({ name: 'device_id', type: 'char', length: 36 }) deviceId: string;
  @Column({ type: 'decimal', precision: 9, scale: 6 }) latitude: string;
  @Column({ type: 'decimal', precision: 9, scale: 6 }) longitude: string;
  @Column({ name: 'accuracy_m', type: 'decimal', precision: 9, scale: 1 }) accuracyM: string;
  @Column({ name: 'captured_at', type: 'datetime', precision: 3 }) capturedAt: Date;
  @Column({ name: 'received_at', type: 'datetime', precision: 3 }) receivedAt: Date;
  @Column({ type: 'enum', enum: LOCATION_PROVENANCES }) provenance: LocationProvenance;
}
