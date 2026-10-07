import { Column, PrimaryColumn } from 'typeorm';

export type DataClass = 'NORMAL' | 'PRIVATE' | 'SENSITIVE';
export type SharingScope =
  'FAMILY_ALL' | 'PARENTS_SENIORS' | 'PARENTS_CHILDREN' | 'PRIVATE' | 'GROUP_MEMBERS' | 'GROUP_MANAGERS';

export const DATA_CLASSES: readonly DataClass[] = ['NORMAL', 'PRIVATE', 'SENSITIVE'];
export const SHARING_SCOPES: readonly SharingScope[] = [
  'FAMILY_ALL',
  'PARENTS_SENIORS',
  'PARENTS_CHILDREN',
  'PRIVATE',
  'GROUP_MEMBERS',
  'GROUP_MANAGERS',
];

/** Columns shared by every registry resource (modules.md §1); resource entities extend this. */
export abstract class ResourceEntity {
  @PrimaryColumn({ type: 'char', length: 36 }) id: string;
  @Column({ name: 'space_id', type: 'char', length: 36 }) spaceId: string;
  @Column({ name: 'created_by_actor_id', type: 'char', length: 36 }) createdByActorId: string;
  @Column({ name: 'data_class', type: 'enum', enum: DATA_CLASSES }) dataClass: DataClass;
  @Column({ name: 'sharing_scope', type: 'enum', enum: SHARING_SCOPES }) sharingScope: SharingScope;
  @Column({ type: 'bigint', unsigned: true }) revision: string;
  @Column({ name: 'created_at', type: 'datetime', precision: 3 }) createdAt: Date;
  @Column({ name: 'updated_at', type: 'datetime', precision: 3 }) updatedAt: Date;
  @Column({ name: 'deleted_at', type: 'datetime', precision: 3, nullable: true }) deletedAt: Date | null;
}
