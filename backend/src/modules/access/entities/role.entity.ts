import { Column, Entity } from 'typeorm';
import { ResourceEntity } from '../../../database/resource-entity';

@Entity({ name: 'roles' })
export class RoleEntity extends ResourceEntity {
  /** OWNER/ADULT/… for built-ins, CUSTOM_* for user-made roles. */
  @Column({ name: 'role_key', type: 'varchar', length: 40 }) roleKey: string;
  @Column({ type: 'varchar', length: 50 }) name: string;
  /** Read through normalizeMatrix(): stored JSON is never trusted to be complete. */
  @Column({ type: 'json' }) matrix: unknown;
  @Column({ type: 'json', nullable: true }) restrictions: unknown;
  @Column({ name: 'is_system', type: 'boolean' }) isSystem: boolean;
  @Column({ name: 'based_on', type: 'varchar', length: 40, nullable: true }) basedOn: string | null;
}
