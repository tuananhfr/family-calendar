import { Column, Entity, PrimaryColumn } from 'typeorm';

export const INTEGRATION_PROVIDERS = ['GOOGLE_CALENDAR', 'GOOGLE_DRIVE', 'ZALO', 'GMAIL', 'SMS', 'OPEN_API'] as const;
export type IntegrationProvider = (typeof INTEGRATION_PROVIDERS)[number];

@Entity({ name: 'integrations' })
export class IntegrationEntity {
  @PrimaryColumn({ name: 'space_id', type: 'char', length: 36 }) spaceId: string;
  @PrimaryColumn({ type: 'enum', enum: INTEGRATION_PROVIDERS }) provider: IntegrationProvider;
  @Column({ type: 'enum', enum: ['CONNECTED', 'ERROR'] }) status: 'CONNECTED' | 'ERROR';
  @Column({ name: 'config_json', type: 'json', nullable: true }) configJson: Record<string, unknown> | null;
  @Column({ name: 'connected_by_actor_id', type: 'char', length: 36, nullable: true }) connectedByActorId:
    | string
    | null;
  @Column({ name: 'connected_at', type: 'datetime', precision: 3, nullable: true }) connectedAt: Date | null;
  @Column({ name: 'updated_at', type: 'datetime', precision: 3 }) updatedAt: Date;
}
