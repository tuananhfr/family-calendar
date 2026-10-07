import { Column, Entity } from 'typeorm';
import { ResourceEntity } from '../../../database/resource-entity';

@Entity({ name: 'folders' })
export class FolderEntity extends ResourceEntity {
  @Column({ type: 'varchar', length: 100 }) name: string;
  @Column({ name: 'parent_id', type: 'char', length: 36, nullable: true }) parentId: string | null;
  /** System folders are created up front and cannot be deleted. */
  @Column({
    name: 'system_key',
    type: 'enum',
    enum: ['PHOTOS', 'DOCUMENTS', 'STUDY', 'HEALTH', 'VIDEOS', 'OTHER'],
    nullable: true,
  })
  systemKey: 'PHOTOS' | 'DOCUMENTS' | 'STUDY' | 'HEALTH' | 'VIDEOS' | 'OTHER' | null;
}
